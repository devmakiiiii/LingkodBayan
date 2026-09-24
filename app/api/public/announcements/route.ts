import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAnnouncementColumnError } from '@/lib/announcements'

const COLUMNS_FULL =
  'id, title, content, category, created_at, updated_at, published_at, expires_at, pinned, is_published, image_url, excerpt'
const COLUMNS_NO_PIN =
  'id, title, content, category, created_at, updated_at, published_at, is_published, image_url, excerpt'
const COLUMNS_BASE = 'id, title, content, category, created_at, updated_at, is_published'

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const now = new Date().toISOString()

    // Richest query first; each fallback drops columns whose migrations have not
    // been applied. Scheduled (future published_at) and expired rows are hidden.
    const attempts = [
      () =>
        adminClient
          .from('announcements')
          .select(COLUMNS_FULL)
          .eq('is_published', true)
          .lte('published_at', now)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('pinned', { ascending: false })
          .order('published_at', { ascending: false }),
      () =>
        adminClient
          .from('announcements')
          .select(COLUMNS_NO_PIN)
          .eq('is_published', true)
          .lte('published_at', now)
          .order('published_at', { ascending: false }),
      () =>
        adminClient
          .from('announcements')
          .select(COLUMNS_BASE)
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
    ]

    let data: any[] | null = null
    let lastError: any = null

    for (const attempt of attempts) {
      const result = await attempt()

      if (!result.error) {
        data = result.data as any[]
        lastError = null
        break
      }

      lastError = result.error
      if (!isAnnouncementColumnError(result.error)) break
    }

    if (lastError) {
      console.error('Error fetching published announcements:', lastError)
      return NextResponse.json({ error: lastError.message || 'Failed to fetch announcements' }, { status: 500 })
    }

    const announcements = (data || []).map((announcement: any) => ({
      ...announcement,
      image_url: announcement.image_url || null,
      excerpt: announcement.excerpt || null,
      published_at: announcement.published_at || null,
      expires_at: announcement.expires_at || null,
      pinned: Boolean(announcement.pinned),
    }))

    return NextResponse.json({ announcements })
  } catch (error: any) {
    console.error('Error in GET /api/public/announcements:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
  }
}