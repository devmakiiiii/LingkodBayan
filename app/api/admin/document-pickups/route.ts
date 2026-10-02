import { NextRequest, NextResponse } from 'next/server'

import { getAdminFromRequest } from '@/lib/admin-auth'
import { createAdminClient, } from '@/lib/supabase/admin'
import { notifyResidentByUserId } from '@/lib/notify'
import { verifyRequest } from '@/lib/request-security'
import { z } from 'zod'

/**
 * Admin management of document pickups (clearance claiming).
 *
 * Lifecycle: preparing -> ready -> claimed.
 *  - POST: register a pickup for a processed request.
 *  - PATCH: advance the status. Moving to 'ready' stamps ready_at and
 *    notifies the resident with their claim code; 'claimed' stamps
 *    claimed_at and records which staff member released the document.
 */

const COLUMNS = `
  id, request_id, resident_id, status, pickup_code, document_title, scheduled_date,
  ready_at, claimed_at, notes, created_at, updated_at,
  requests(id, title, category, status),
  residents(id, first_name, last_name, email, user_id, address, phone)
`

const createSchema = z.object({
  requestCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(REQ|RPT)-[0-9A-F]{8}$/, 'Use a tracking code like REQ-1A2B3C4D'),
  documentTitle: z.string().max(200).optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD date format')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(500).optional(),
})

const updateSchema = z.object({
  pickupId: z.string().uuid('Invalid pickup ID'),
  status: z.enum(['preparing', 'ready', 'claimed']),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD date format')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(500).optional(),
})

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('document_pickups')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ pickups: data ?? [] })
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = createSchema.parse(await request.json())
    const adminClient = createAdminClient()

    // Resolve the tracking code to the newest matching request row.
    const codePrefix = body.requestCode.slice(4)
    const { data: requestRows } = await adminClient
      .from('requests')
      .select('id, resident_id, title, category, status')
      .gte('id', codePrefix)
      .lt('id', codePrefix + '\uffff')
      .order('created_at', { ascending: false })
      .limit(1)
    const requestRow = (requestRows ?? [])[0]
    if (!requestRow) {
      return NextResponse.json({ error: 'No request found for that tracking code.' }, { status: 404 })
    }

    const { data, error } = await adminClient
      .from('document_pickups')
      .insert({
        request_id: requestRow.id,
        resident_id: requestRow.resident_id,
        status: 'preparing',
        document_title: body.documentTitle?.trim() || requestRow.title || null,
        scheduled_date: body.scheduledDate ? body.scheduledDate : null,
        notes: body.notes?.trim() || null,
      })
      .select(COLUMNS)
      .single()

    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: 'A pickup is already registered for this request.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: beneficiaryRows } = await adminClient
      .from('residents')
      .select('user_id')
      .eq('id', (data as any).resident_id)
      .limit(1)
    const beneficiaryUserId = (beneficiaryRows ?? [])[0]?.user_id
    if (beneficiaryUserId) {
      await notifyResidentByUserId(beneficiaryUserId, {
        type: 'document_pickup_registered',
        title: 'Document is being prepared for pickup',
        body: `Your document "${(data as any).document_title || 'request'}" is being prepared. You will be notified when it is ready for pickup.`,
        link: '/citizen/document-pickups',
      })
    }
    return NextResponse.json({ pickup: data })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    console.error('Error in POST /api/admin/document-pickups:', error)
    return NextResponse.json({ error: 'Failed to register the pickup.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = updateSchema.parse(await request.json())
    const adminClient = createAdminClient()

    const { data: existingRows } = await adminClient
      .from('document_pickups')
      .select(COLUMNS)
      .eq('id', body.pickupId)
      .limit(1)
    const existing = (existingRows ?? [])[0] as any
    if (!existing) {
      return NextResponse.json({ error: 'Pickup not found.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    }
    if (body.scheduledDate !== undefined) updateData.scheduled_date = body.scheduledDate || null
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null
    if (body.status === 'ready') {
      updateData.ready_at = existing.ready_at ?? new Date().toISOString()
    }
    if (body.status === 'claimed') {
      updateData.claimed_at = new Date().toISOString()
      updateData.claimed_by_staff = admin.id
      if (!existing.ready_at) updateData.ready_at = new Date().toISOString()
    }

    const { data, error } = await adminClient
      .from('document_pickups')
      .update(updateData)
      .eq('id', body.pickupId)
      .select(COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const residentUserId = (data as any).residents?.user_id
    if (residentUserId) {
      if (body.status === 'ready') {
        await notifyResidentByUserId(residentUserId, {
          type: 'document_ready_for_pickup',
          title: 'Your document is ready for pickup',
          body: `"${(data as any).document_title || 'Your document'}" is ready. Present claim code ${(data as any).pickup_code} at the barangay hall.`,
          link: '/citizen/document-pickups',
        })
      } else if (body.status === 'claimed') {
        await notifyResidentByUserId(residentUserId, {
          type: 'document_claimed',
          title: 'Document claimed',
          body: `"${(data as any).document_title || 'Your document'}" has been claimed. Thank you!`,
          link: '/citizen/document-pickups',
        })
      }
    }

    return NextResponse.json({ pickup: data })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    console.error('Error in PATCH /api/admin/document-pickups:', error)
    return NextResponse.json({ error: 'Failed to update the pickup.' }, { status: 500 })
  }
}
