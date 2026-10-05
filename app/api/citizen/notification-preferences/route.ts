import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyRequest } from '@/lib/request-security'
import { notificationPreferencesSchema, DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/lib/schemas'

/**
 * Per-resident notification opt-ins (migration 47). GET returns the effective
 * preferences — the stored row merged over the all-true defaults — so the
 * Settings page and the notifications hook can both treat a missing row the
 * same as "everything on". PUT upserts the full set; partial writes are
 * rejected by the shared zod schema.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('request_updates, complaint_updates, pickup_reminders, announcements')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      // Deployments without migration 47 land here; reporting the defaults
      // keeps the Settings page usable instead of erroring.
      console.error('Failed to load notification preferences:', error.message)
      return NextResponse.json({ preferences: DEFAULT_NOTIFICATION_PREFERENCES, persisted: false })
    }

    return NextResponse.json({
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data ?? {}) } as NotificationPreferences,
      persisted: data !== null,
    })
  } catch (error) {
    console.error('Notification preferences GET error:', error)
    return NextResponse.json({ error: 'Failed to load notification preferences' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json().catch(() => null)
    const parsed = notificationPreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid preferences', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert(
        { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )

    if (error) {
      console.error('Failed to save notification preferences:', error.message)
      return NextResponse.json({ error: 'Failed to save notification preferences' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, preferences: parsed.data })
  } catch (error) {
    console.error('Notification preferences PUT error:', error)
    return NextResponse.json({ error: 'Failed to save notification preferences' }, { status: 500 })
  }
}
