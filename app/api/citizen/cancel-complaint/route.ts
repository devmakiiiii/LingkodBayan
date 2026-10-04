import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelComplaintSchema } from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'
import { canTransitionComplaint } from '@/lib/status-machine'

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

    const body = await request.json()
    const validated = cancelComplaintSchema.parse(body)

    const adminSupabase = createAdminClient()

    const { data: complaint, error: complaintError } = await adminSupabase
      .from('complaints')
      .select('id, resident_id, status')
      .eq('id', validated.complaintId)
      .single()

    if (complaintError || !complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    const { data: resident } = await supabase
      .from('residents')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!resident || resident.id !== complaint.resident_id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Only allow cancellation from the 'open' state — once an official
    // starts reviewing (under_investigation) or resolves the complaint,
    // the citizen can no longer cancel it.
    if (!canTransitionComplaint(complaint.status, 'cancelled')) {
      return NextResponse.json(
        { error: 'This complaint can no longer be cancelled. It may already be under review or resolved.' },
        { status: 400 },
      )
    }

    const { error: updateError } = await adminSupabase
      .from('complaints')
      .update({ status: 'cancelled' })
      .eq('id', validated.complaintId)

    if (updateError) {
      logger.error('Failed to cancel complaint', updateError, { context: 'api/cancel-complaint' })
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Cancel complaint error', error, { context: 'api/cancel-complaint' })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to cancel complaint' }, { status: 500 })
  }
}
