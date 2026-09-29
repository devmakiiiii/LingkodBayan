/**
 * Representative authorizations (proxy filing).
 *
 * A resident can authorize another registered resident — a family member, a
 * neighbor, or a purok leader — to file service requests on their behalf.
 * This is the access bridge for residents who cannot operate the portal
 * themselves (no smartphone, no email, or living far from the barangay).
 *
 * All queries go through the caller's Supabase client so RLS is the single
 * source of truth: a user can only ever see authorizations they are a party
 * to, only the represented resident can grant, and either party can revoke.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RepresentativeAuthorization {
  id: string
  represented_resident_id: string
  representative_resident_id: string
  status: 'active' | 'revoked'
  consent_note: string | null
  granted_at: string
  revoked_at: string | null
  created_at: string
}

/** Base columns of representative_authorizations; party names are resolved separately. */
const AUTHORIZATION_SELECT =
  'id, represented_resident_id, representative_resident_id, status, consent_note, granted_at, revoked_at, created_at'

type PartyInfo = { first_name: string | null; last_name: string | null; email: string | null } | null

type PartyDirectory = Map<string, { first_name: string | null; last_name: string | null; email: string | null }>

/**
 * Resolves the display fields (id, first_name, last_name, email) for residents
 * the caller shares an authorization with.
 *
 * This is deliberately NOT a PostgREST embedded join. The residents table has a
 * strict SELECT policy ("Residents can view their own data" ->
 * USING (auth.uid() = user_id)), and PostgREST applies that policy to embedded
 * joins, so `residents!representative_authorizations_represented_resident_id_fkey(...)`
 * always resolved to null for the counterparty and the UI fell back to
 * "Unnamed resident". Loosening the residents policy would expose every
 * resident's full row to anyone they authorized, so migration 38 adds a
 * SECURITY DEFINER helper that returns only this narrow projection and only for
 * counterparties. If it is unavailable the caller still gets its rows, just
 * without names.
 */
async function loadProxyParties(
  supabase: SupabaseClient,
  residentIds: string[],
): Promise<PartyDirectory> {
  const ids = Array.from(new Set(residentIds.filter(Boolean)))
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase.rpc('proxy_party_directory', { p_resident_ids: ids })
  if (error) {
    console.warn('Failed to resolve proxy party names:', error)
    return new Map()
  }

  return new Map(
    ((data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>).map(
      (party) => [party.id, { first_name: party.first_name, last_name: party.last_name, email: party.email }],
    ),
  )
}

/** Authorizations I granted (others may file for me). */
export async function listAuthorizationsIGranted(
  supabase: SupabaseClient,
  residentId: string,
): Promise<Array<RepresentativeAuthorization & { representative?: PartyInfo }>> {
  const { data, error } = await supabase
    .from('representative_authorizations')
    .select(AUTHORIZATION_SELECT)
    .eq('represented_resident_id', residentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const authorizations = (data ?? []) as RepresentativeAuthorization[]
  const parties = await loadProxyParties(
    supabase,
    authorizations.map((authorization) => authorization.representative_resident_id),
  )
  return authorizations.map((authorization) => ({
    ...authorization,
    representative: parties.get(authorization.representative_resident_id) ?? null,
  }))
}

/** Authorizations granted to me (residents I may file for). */
export async function listAuthorizationsGrantedToMe(
  supabase: SupabaseClient,
  residentId: string,
): Promise<Array<RepresentativeAuthorization & { represented?: PartyInfo }>> {
  const { data, error } = await supabase
    .from('representative_authorizations')
    .select(AUTHORIZATION_SELECT)
    .eq('representative_resident_id', residentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const authorizations = (data ?? []) as RepresentativeAuthorization[]
  const parties = await loadProxyParties(
    supabase,
    authorizations.map((authorization) => authorization.represented_resident_id),
  )
  return authorizations.map((authorization) => ({
    ...authorization,
    represented: parties.get(authorization.represented_resident_id) ?? null,
  }))
}

/** Active authorizations granted to me, for the "file on behalf of" picker. */
export async function listResidentsWhoAuthorizedMe(
  supabase: SupabaseClient,
  residentId: string,
): Promise<Array<{ id: string; firstName: string; lastName: string; email: string | null }>> {
  const authorizations = await listAuthorizationsGrantedToMe(supabase, residentId)
  return authorizations
    .filter((authorization) => authorization.status === 'active')
    .map((authorization) => ({
      id: authorization.represented_resident_id,
      firstName: authorization.represented?.first_name ?? '',
      lastName: authorization.represented?.last_name ?? '',
      email: authorization.represented?.email ?? null,
    }))
}

export type GrantResult =
  | { ok: true; authorization: RepresentativeAuthorization }
  | { ok: false; error: string }

/**
 * Grants a proxy authorization by looking up the representative by their
 * registered email. Both residents must already have portal accounts.
 * Goes through /api/citizen/proxy-authorizations so both parties get an
 * in-app notification (user_notifications is server-write only).
 */
export async function grantAuthorization(
  supabase: SupabaseClient,
  representedResidentId: string,
  representativeEmail: string,
  consentNote?: string,
): Promise<GrantResult> {
  const email = representativeEmail.trim().toLowerCase()
  if (!email) return { ok: false, error: 'Please enter the email address of the person you are authorizing.' }

  const response = await fetch('/api/citizen/proxy-authorizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ representativeEmail: email, consentNote }),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false, error: data?.error || 'Failed to grant the authorization. Please try again.' }
  }
  return { ok: true, authorization: data.authorization as RepresentativeAuthorization }
}

/** Revokes an authorization. Either party may revoke. */
export async function revokeAuthorization(
  supabase: SupabaseClient,
  authorizationId: string,
): Promise<GrantResult> {
  const response = await fetch('/api/citizen/proxy-authorizations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizationId }),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false, error: data?.error || 'Failed to revoke the authorization. Please try again.' }
  }
  return { ok: true, authorization: data.authorization as RepresentativeAuthorization }
}

/**
 * Display name for the other party of an authorization.
 *
 * Prefers the full name, then the email they registered with. "Unnamed resident"
 * only means the counterparty's profile has no name and no email on file - it is
 * no longer reachable merely because the caller cannot read the other party's
 * residents row, since the party details are resolved by `proxy_party_directory`
 * (migration 38) rather than by an RLS-filtered embedded join.
 */
export function authorizationPartyName(
  authorization: RepresentativeAuthorization & { representative?: PartyInfo; represented?: PartyInfo },
): string {
  // Exactly one of the two is populated, depending on which list this row came
  // from, so prefer the first non-null one rather than whichever is truthy.
  const person = authorization.representative ?? authorization.represented
  const name = person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() : ''
  return name || person?.email || 'Unnamed resident'
}

