import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()

    let { data, error }: { data: any[] | null; error: any } = await adminClient
      .from('announcements')
      .select('id, title, content, category, created_at, is_published, image_url, excerpt')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
      const result = await adminClient
        .from('announcements')
        .select('id, title, content, category, created_at, is_published')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
      data = result.data as any[]
      error = result.error
    }

    if (error) {
      console.error('Error fetching published announcements:', error)
      return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
    }

    const announcements = (data || []).map((announcement: any) => ({
      ...announcement,
      image_url: announcement.image_url || null,
      excerpt: announcement.excerpt || null,
    }))

    return NextResponse.json({ announcements })
  } catch (error: any) {
    console.error('Error in GET /api/public/announcements:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
  }
}