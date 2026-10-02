import { NextRequest, NextResponse } from 'next/server'

import { getAdminFromRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRequest } from '@/lib/request-security'
import { adminComplaintMessageSchema } from '@/lib/schemas'
import { sendSms } from '@/lib/sms'
import { logger } from '@/lib/logger'

/**
 * Admin-authored complaint messages (replies and automatic status/assignment
 * activity notes).
 *
 * Complaint threads live in `complaint_messages`, which is the single citizen-
 * facing source for report updates: the unread bell badge, the notifications
 * page and the dashboard's "unread replies" card all read it. The browser used
 * to insert these rows directly through RLS, which had two failure modes:
 *   1. nothing was written when the admin's view had no cached resident account
 *      (`residentUserId` was empty), and
 *   2. a rejected insert could pass unnoticed in the auto-assign loop.
 *
 * Routing the write through the server fixes both: the resident is resolved
 * from the complaint itself (service-role client), the thread row is recorded
 * unconditionally, and a text message is sent for residents without the app
 * open. Complaints deliberately do NOT also create a `user_notifications` row —
 * that would duplicate the same reply on the notifications page, which merges
 * both sources.
 */
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
    const body = adminComplaintMessageSchema.parse(await request.json())
    const adminClient = createAdminClient()

    // Resolve the thread owner so the message is attributed to the signed-in
    // admin and delivered to the right resident.
    const { data: complaint, error: complaintError } = await adminClient
      .from('complaints')
      .select('id, resident_id, title')
      .eq('id', body.complaintId)
      .maybeSingle()

    if (complaintError) {
      logger.error('Failed to load complaint for message', complaintError, { context: 'api/admin/complaint-messages' })
      return NextResponse.json({ error: 'Failed to load the report.' }, { status: 500 })
    }
    if (!complaint) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
    }

    const { data: resident } = await adminClient
      .from('residents')
      .select('user_id, phone')
      .eq('id', complaint.resident_id)
      .maybeSingle()

    const residentUserId = resident?.user_id ?? null

    const { data: inserted, error: insertError } = await adminClient
      .from('complaint_messages')
      .insert({
        complaint_id: complaint.id,
        recipient_user_id: residentUserId,
        sender_id: admin.id,
        message: body.message,
        message_type: body.messageType,
        is_read: false,
      })
      .select()
      .single()

    if (insertError) {
      logger.error('Failed to record complaint message', insertError, { context: 'api/admin/complaint-messages' })
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // SMS is best-effort and fails open (see lib/sms.ts): a gateway that is not
    // configured or is down must never fail the admin's action.
    if (resident?.phone) {
      const title = body.messageType === 'reply' ? 'New reply from the Barangay' : 'Update on your report'
      const result = await sendSms(resident.phone, title, body.message)
      if (!result.sent && result.reason !== 'not_configured' && result.reason !== 'no_phone') {
        logger.warn('Complaint SMS not delivered', { context: 'api/admin/complaint-messages', reason: result.reason })
      }
    }

    return NextResponse.json({
      message: inserted,
      // The resident sees the message in-app only if their record is linked to a
      // portal account; callers surface a notice when it is not.
      residentHasAccount: Boolean(residentUserId),
    })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    logger.error('Error in POST /api/admin/complaint-messages', error, { context: 'api/admin/complaint-messages' })
    return NextResponse.json({ error: 'Failed to record the message.' }, { status: 500 })
  }
}