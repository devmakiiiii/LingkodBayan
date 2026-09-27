import { NextRequest, NextResponse } from 'next/server'

import { getAdminFromRequest } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyResidentByUserId } from '@/lib/notify'
import { verifyRequest } from '@/lib/request-security'
import { z } from 'zod'

/**
 * Server-side authoring of representative authorizations (proxy filing).
 *
 * The citizen management page reads through RLS directly, but grant/revoke go
 * through this route so every change can also create in-app notifications
 * (user_notifications has no INSERT policy — only server code can write it).
 *
 * Admins (barangay staff at the hall) may additionally grant on behalf of a
 * resident who cannot operate the portal themselves by passing
 * `representedEmail`.
 */

const grantSchema = z.object({
  representativeEmail: z.string().email('Enter a valid email for the representative'),
  representedEmail: z.string().email('Enter a valid email for the represented resident').optional().or(z.literal('')),
  consentNote: z.string().max(200).optional(),
})

const revokeSchema = z.object({
  authorizationId: z.string().uuid('Invalid authorization ID'),
})

const AUTHORIZATION_SELECT = `
  id, represented_resident_id, representative_resident_id, status, consent_note,
  granted_at, revoked_at, created_at,
  represented:residents!representative_authorizations_represented_resident_id_fkey(id, first_name, last_name, email, user_id),
  representative:residents!representative_authorizations_representative_resident_id_fkey(id, first_name, last_name, email, user_id)
`

function fullName(person?: { first_name: string | null; last_name: string | null } | null) {
  return person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() : ''
}

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('representative_authorizations')
    .select(AUTHORIZATION_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ authorizations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = grantSchema.parse(await request.json())
    const adminClient = createAdminClient()

    // Resolve the acting resident (the account holder calling the route).
    const { data: actingResident } = await adminClient
      .from('residents')
      .select('id, user_id, first_name, last_name, email')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const acting = (actingResident ?? [])[0]
    if (!acting) {
      return NextResponse.json({ error: 'Your resident profile was not found.' }, { status: 404 })
    }

    // Admins may grant on behalf of another resident (assisted onboarding).
    const adminUser = await getAdminFromRequest(request)
    let represented = acting
    if (body.representedEmail && body.representedEmail.trim().toLowerCase() !== acting.email?.toLowerCase()) {
      if (!adminUser) {
        return NextResponse.json({ error: 'Only barangay staff may authorize on behalf of another resident.' }, { status: 403 })
      }
      const { data: representedRows } = await adminClient
        .from('residents')
        .select('id, user_id, first_name, last_name, email')
        .eq('email', body.representedEmail.trim().toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1)
      const matchedRepresented = (representedRows ?? [])[0]
      if (!matchedRepresented) {
        return NextResponse.json({ error: 'No registered resident was found for the represented email.' }, { status: 404 })
      }
      represented = matchedRepresented
    }

    const { data: representativeRows } = await adminClient
      .from('residents')
      .select('id, user_id, first_name, last_name, email')
      .eq('email', body.representativeEmail.trim().toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
    const representative = (representativeRows ?? [])[0]
    if (!representative) {
      return NextResponse.json({ error: 'No registered resident was found with that email. They need a LingkodBayan account first.' }, { status: 404 })
    }
    if (representative.id === represented.id) {
      return NextResponse.json({ error: 'The represented resident and the representative must be different people.' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('representative_authorizations')
      .insert({
        represented_resident_id: represented.id,
        representative_resident_id: representative.id,
        status: 'active',
        consent_note: body.consentNote?.trim() || null,
      })
      .select(AUTHORIZATION_SELECT)
      .single()

    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: 'This person is already authorized to file for that resident.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify both parties (best-effort: a failed notification must not fail
    // the grant itself).
    const grantorName = adminUser ? 'Barangay staff' : fullName(represented)
    if (represented.user_id) {
      await notifyResidentByUserId(represented.user_id, {
        type: 'proxy_granted',
        title: 'Proxy authorization granted',
        body: `${grantorName || 'You'} authorized ${fullName(representative) || 'a registered resident'} to file service requests on your behalf.`,
        link: '/citizen/proxy-filing',
      })
    }
    if (representative.user_id) {
      await notifyResidentByUserId(representative.user_id, {
        type: 'proxy_granted',
        title: 'You can now file for another resident',
        body: `${grantorName || fullName(represented)} authorized you to file service requests on their behalf. Choose them under "File on behalf of" when requesting a service.`,
        link: '/citizen/request-service',
      })
    }

    return NextResponse.json({ authorization: data })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    console.error('Error in POST /api/citizen/proxy-authorizations:', error)
    return NextResponse.json({ error: 'Failed to grant authorization' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = revokeSchema.parse(await request.json())
    const adminClient = createAdminClient()

    const { data: rows } = await adminClient
      .from('representative_authorizations')
      .select(AUTHORIZATION_SELECT)
      .eq('id', body.authorizationId)
      .limit(1)
    const authorization = (rows ?? [])[0] as any | undefined
    if (!authorization) {
      return NextResponse.json({ error: 'Authorization not found.' }, { status: 404 })
    }

    const adminUser = await getAdminFromRequest(request)
    if (!adminUser) {
      // Non-admins may only revoke authorizations they are a party to.
      const { data: actingRows } = await adminClient
        .from('residents')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const actingId = (actingRows ?? [])[0]?.id
      const isParty =
        actingId &&
        (actingId === authorization.represented_resident_id || actingId === authorization.representative_resident_id)
      if (!isParty) {
        return NextResponse.json({ error: 'You are not a party to this authorization.' }, { status: 403 })
      }
    }

    if (authorization.status === 'revoked') {
      return NextResponse.json({ authorization })
    }

    const now = new Date().toISOString()
    const { data, error } = await adminClient
      .from('representative_authorizations')
      .update({ status: 'revoked', revoked_at: now, updated_at: now })
      .eq('id', body.authorizationId)
      .select(AUTHORIZATION_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Best-effort notifications to both parties.
    for (const party of [authorization.represented, authorization.representative]) {
      if (party?.user_id) {
        await notifyResidentByUserId(party.user_id, {
          type: 'proxy_revoked',
          title: 'Proxy authorization revoked',
          body: 'A proxy filing authorization has been revoked. New requests can no longer be filed under it.',
          link: '/citizen/proxy-filing',
        })
      }
    }

    return NextResponse.json({ authorization: data })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    console.error('Error in PATCH /api/citizen/proxy-authorizations:', error)
    return NextResponse.json({ error: 'Failed to revoke authorization' }, { status: 500 })
  }
}
