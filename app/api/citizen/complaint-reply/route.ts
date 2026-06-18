import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { complaintId, message } = body

    if (!complaintId || !message?.trim()) {
      return NextResponse.json({ error: 'Complaint ID and message are required' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { data: complaint, error: complaintError } = await adminSupabase
      .from('complaints')
      .select('id, resident_id')
      .eq('id', complaintId)
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
        complaint_id: complaintId,
        sender_id: user.id,
        recipient_user_id: null,
        message: message.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to send reply:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: data })
  } catch (error) {
    console.error('Complaint reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}