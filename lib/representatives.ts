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

/** Rows whose SELECT embeds a `residents(...)` join on the other party. */
const AUTHORIZATION_SELECT =
  'id, represented_resident_id, representative_resident_id, status, consent_note, granted_at, revoked_at, created_at'

type PartyInfo = { first_name: string | null; last_name: string | null; email: string | null } | null

/** Authorizations I granted (others may file for me). */
export async function listAuthorizationsIGranted(
  supabase: SupabaseClient,
  residentId: string,
): Promise<Array<RepresentativeAuthorization & { representative?: PartyInfo }>> {
  const { data, error } = await supabase
    .from('representative_authorizations')
    .select(
      `${AUTHORIZATION_SELECT}, representative:residents!representative_authorizations_representative_resident_id_fkey(first_name, last_name, email)`,
    )
    .eq('represented_resident_id', residentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Array<RepresentativeAuthorization & { representative?: PartyInfo }>
}

/** Authorizations granted to me (residents I may file for). */
export async function listAuthorizationsGrantedToMe(
  supabase: SupabaseClient,
  residentId: string,
): Promise<Array<RepresentativeAuthorization & { represented?: PartyInfo }>> {
  const { data, error } = await supabase
    .from('representative_authorizations')
    .select(
      `${AUTHORIZATION_SELECT}, represented:residents!representative_authorizations_represented_resident_id_fkey(first_name, last_name, email)`,
    )
    .eq('representative_resident_id', residentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Array<RepresentativeAuthorization & { represented?: PartyInfo }>
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

/** Display name for the other party embedded by the list queries. */
export function authorizationPartyName(
  authorization: RepresentativeAuthorization & { representative?: PartyInfo; represented?: PartyInfo },
): string {
  const person = authorization.representative ?? authorization.represented
  const name = person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() : ''
  return name || person?.email || 'Unnamed resident'
}

