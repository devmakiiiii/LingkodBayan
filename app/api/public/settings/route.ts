import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public, whitelisted view of the barangay's contact details.
 *
 * system_settings is admin-only under RLS, so this route exposes just the
 * fields the public footer needs — nothing else (no mission/vision/signatures).
 * Mirrors the pattern of /api/public/announcements.
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('system_settings')
      .select('setting_key, value')
      .in('setting_key', ['barangay_info', 'barangay_identity'])

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

    return NextResponse.json({
      contact: {
        name: info.barangay_name || identity.name || null,
        address: info.address || identity.address || null,
        phone: info.contact_number || identity.phone || null,
        email: info.email || identity.email || null,
        office_hours: info.office_hours || null,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/public/settings:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 })
  }
}