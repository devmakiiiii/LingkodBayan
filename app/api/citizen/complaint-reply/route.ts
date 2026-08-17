import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { complaintReplySchema } from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'

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
    const validated = complaintReplySchema.parse(body)

    const adminSupabase = createAdminClient()

    const { data: complaint, error: complaintError } = await adminSupabase
      .from('complaints')
      .select('id, resident_id')
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

    const { data, error } = await supabase
      .from('complaint_messages')
      .insert({
        complaint_id: validated.complaintId,
        sender_id: user.id,
        recipient_user_id: null,
        message: validated.message.trim(),
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to send reply', error, { context: 'api/complaint-reply' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: data })
  } catch (error: any) {
    logger.error('Complaint reply error', error, { context: 'api/complaint-reply' })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}