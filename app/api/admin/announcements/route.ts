import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnnouncementSchema, updateAnnouncementSchema, deleteAnnouncementSchema } from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
import { logAuditAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'

function generateExcerpt(content: string, maxLength = 200): string {
  const stripped = content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength) + '...'
}

function sanitizeAnnouncementInput(body: Record<string, unknown>) {
  return {
    title: String(body.title || '').trim(),
    content: String(body.content || '').trim(),
    category: String(body.category || '').trim(),
    is_published: Boolean(body.is_published),
    image_url: body.image_url ? String(body.image_url).trim() : null,
    excerpt: body.excerpt ? String(body.excerpt).trim() : null,
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const adminClient = createAdminClient()

  let { data, error }: { data: any[] | null; error: any } = await adminClient
    .from('announcements')
    .select('id, title, content, category, created_at, is_published, image_url, excerpt')
    .order('created_at', { ascending: false })

  if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
    logger.warn('Optional columns not found, falling back to query without them', { context: 'api/announcements' })
    const result = await adminClient
      .from('announcements')
      .select('id, title, content, category, created_at, is_published')
      .order('created_at', { ascending: false })
    data = result.data as any[]
    error = result.error
  }

  if (error) {
    logger.error('Error fetching announcements', error, { context: 'api/announcements' })
    return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
  }

  const announcements = (data || []).map((announcement: any) => ({
    ...announcement,
    image_url: announcement.image_url || null,
    excerpt: announcement.excerpt || null,
  }))

  return NextResponse.json({ announcements })
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = createAnnouncementSchema.parse(body)

    const adminClient = createAdminClient()

    const finalExcerpt = validated.excerpt || generateExcerpt(validated.content)

    let { data, error }: { data: any[] | null; error: any } = await adminClient
      .from('announcements')
      .insert({
        title: validated.title,
        content: validated.content,
        category: validated.category,
        is_published: validated.is_published,
        image_url: validated.image_url || null,
        excerpt: finalExcerpt,
      })
      .select()

    if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
      logger.warn('Optional columns not found, inserting without them', { context: 'api/announcements' })
      const result = await adminClient
        .from('announcements')
        .insert({
          title: validated.title,
          content: validated.content,
          category: validated.category,
          is_published: validated.is_published,
        })
        .select()
      data = result.data
      error = result.error
    }

    if (error) {
      logger.error('Error creating announcement', error, { context: 'api/announcements' })
      return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
    }

    await logAuditAction({
      adminId: user.id,
      adminEmail: user.email ?? undefined,
      action: 'announcement_created',
      resourceType: 'announcement',
      resourceId: data?.[0]?.id,
      newValues: { title: validated.title, category: validated.category, is_published: validated.is_published },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ announcement: data?.[0] || null })
  } catch (error: any) {
    logger.error('Error in POST /api/admin/announcements', error, { context: 'api/announcements' })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = updateAnnouncementSchema.parse(body)

    const adminClient = createAdminClient()

    const finalExcerpt = validated.excerpt || (validated.content ? generateExcerpt(validated.content) : null)

    let { data, error }: { data: any[] | null; error: any } = await adminClient
      .from('announcements')
      .update({
        title: validated.title,
        content: validated.content,
        category: validated.category,
        is_published: validated.is_published,
        image_url: validated.image_url || null,
        excerpt: finalExcerpt,
      })
      .eq('id', validated.id)
      .select()

    if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
      logger.warn('Optional columns not found, updating without them', { context: 'api/announcements' })
      const result = await adminClient
        .from('announcements')
        .update({
          title: validated.title,
          content: validated.content,
          category: validated.category,
          is_published: validated.is_published,
        })
        .eq('id', validated.id)
        .select()
      data = result.data
      error = result.error
    }

    if (error) {
      logger.error('Error updating announcement', error, { context: 'api/announcements' })
      return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
    }

    await logAuditAction({
      adminId: user.id,
      adminEmail: user.email ?? undefined,
      action: 'announcement_updated',
      resourceType: 'announcement',
      resourceId: validated.id,
      newValues: { title: validated.title, category: validated.category, is_published: validated.is_published },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ announcement: data?.[0] || null })
  } catch (error: any) {
    logger.error('Error in PUT /api/admin/announcements', error, { context: 'api/announcements' })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = deleteAnnouncementSchema.parse(body)

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', validated.id)

    if (error) {
      logger.error('Error deleting announcement', error, { context: 'api/announcements' })
      return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
    }

    await logAuditAction({
      adminId: user.id,
      adminEmail: user.email ?? undefined,
      action: 'announcement_deleted',
      resourceType: 'announcement',
      resourceId: validated.id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error in DELETE /api/admin/announcements', error, { context: 'api/announcements' })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
  }
}