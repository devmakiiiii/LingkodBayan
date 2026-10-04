import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyRequest } from '@/lib/request-security'
import { normalizeLocale } from '@/lib/i18n'

/**
 * Persists the signed-in resident's language preference (`residents.locale`,
 * migration 45). The citizen locale toggle calls this after writing the
 * cookie/localStorage so server-side SMS notifications can use the same
 * language the resident picked in the portal. Fail-soft: an unresolvable
 * profile returns 200 so the UI toggle is never blocked.
 */
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

    const body = (await request.json().catch(() => null)) as { locale?: unknown } | null
    const locale = normalizeLocale(body?.locale)

    const { error } = await supabase
      .from('residents')
      .update({ locale })
      .eq('user_id', user.id)

    if (error) {
      // Older deployments without migration 45 land here; the portal keeps
      // working with the cookie-based locale only.
      console.error('Failed to persist resident locale:', error.message)
      return NextResponse.json({ ok: false, locale })
    }

    return NextResponse.json({ ok: true, locale })
  } catch (error) {
    console.error('Locale preference error:', error)
    return NextResponse.json({ error: 'Failed to save locale preference' }, { status: 500 })
  }
}
