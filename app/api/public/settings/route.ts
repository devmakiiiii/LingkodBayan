import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public, whitelisted view of the barangay's contact details and mission/vision.
 *
 * system_settings is admin-only under RLS, so this route exposes just the
 * fields the public homepage needs — nothing else (no signatures).
 * Mirrors the pattern of /api/public/announcements.
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('system_settings')
      .select('setting_key, value')
      .in('setting_key', ['barangay_info', 'barangay_identity', 'mission_vision', 'office_closures', 'site_banner'])

    if (error) {
      console.error('Error fetching public settings:', error)
      return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 })
    }

    const settingsMap: Record<string, any> = {}
    ;(data || []).forEach((row: { setting_key: string; value: unknown }) => {
      settingsMap[row.setting_key] = row.value
    })

    // The admin settings page writes `barangay_info`; the charter seed writes
    // `barangay_identity`. Prefer admin-edited values, fall back to the seed.
    const info = settingsMap.barangay_info || {}
    const identity = settingsMap.barangay_identity || {}

    // Mission & vision: only pass through the whitelisted fields, and omit the
    // object entirely when nothing meaningful has been saved so the homepage
    // can hide the section.
    const mv = settingsMap.mission_vision || {}
    const mission = typeof mv.mission === 'string' ? mv.mission.trim() : ''
    const vision = typeof mv.vision === 'string' ? mv.vision.trim() : ''
    const servicePledge: { title: string; description: string }[] = Array.isArray(mv.service_pledge)
      ? mv.service_pledge
          .filter(
            (item: unknown): item is { title: string; description: string } =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as { title?: unknown }).title === 'string' &&
              (item as { title: string }).title.trim().length > 0 &&
              typeof (item as { description?: unknown }).description === 'string' &&
              (item as { description: string }).description.trim().length > 0
          )
          .map((item: { title: string; description: string }) => ({
            title: item.title.trim(),
            description: item.description.trim(),
          }))
      : []
    const missionVision =
      mission || vision || servicePledge.length > 0
        ? { mission: mission || null, vision: vision || null, service_pledge: servicePledge }
        : null

    // Office closures: expose only entries whose window has not fully elapsed
    // (today counts as active — the office may already be closed right now).
    // Date math runs on plain YYYY-MM-DD strings to avoid timezone drift;
    // the +1 day offset produces the exclusive "day after the last closed day".
    const oc = settingsMap.office_closures || {}
    const todayIso = new Date().toISOString().slice(0, 10)
    const closures: { date: string; end_date: string | null; reason: string }[] = Array.isArray(oc.closures)
      ? oc.closures
          .filter(
            (item: unknown): item is { date: string; end_date?: string; reason: string } =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as { date?: unknown }).date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test((item as { date: string }).date) &&
              typeof (item as { reason?: unknown }).reason === 'string' &&
              (item as { reason: string }).reason.trim().length > 0
          )
          .filter((item: { date: string; end_date?: string }) => {
            const lastDay =
              typeof item.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.end_date) && item.end_date > item.date
                ? item.end_date
                : item.date
            // Keep while the exclusive day-after is still in the future.
            return lastDay >= todayIso
          })
          .map((item: { date: string; end_date?: string; reason: string }) => ({
            date: item.date,
            end_date:
              typeof item.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.end_date) && item.end_date > item.date
                ? item.end_date
                : null,
            reason: item.reason.trim(),
          }))
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
      : []

    // Site banner: only surface when enabled with a non-empty message.
    const sb = settingsMap.site_banner || {}
    const siteBanner =
      sb.enabled === true && typeof sb.message === 'string' && sb.message.trim().length > 0
        ? {
            message: sb.message.trim(),
            variant: sb.variant === 'warning' || sb.variant === 'critical' ? sb.variant : 'info',
          }
        : null

    return NextResponse.json({
      contact: {
        name: info.barangay_name || identity.name || null,
        address: info.address || identity.address || null,
        phone: info.contact_number || identity.phone || null,
        email: info.email || identity.email || null,
        office_hours: info.office_hours || null,
      },
      mission_vision: missionVision,
      office_closures: closures.length > 0 ? closures : null,
      site_banner: siteBanner,
    })
  } catch (error: any) {
    console.error('Error in GET /api/public/settings:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 })
  }
}