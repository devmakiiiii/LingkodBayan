import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createAnnouncementSchema,
  deleteAnnouncementSchema,
  setAnnouncementPublishStateSchema,
  updateAnnouncementSchema,
} from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
import { logAuditAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'
import { getAdminFromRequest } from '@/lib/admin-auth'
import { sanitizeRichText, stripHtml } from '@/lib/html-sanitize'
import { isAnnouncementColumnError } from '@/lib/announcements'

const ANNOUNCEMENT_BUCKET = 'announcement-images'

/**
 * Selects run from richest to leanest so the feature keeps working on databases
 * where the optional-column migrations (14, 15, 26, 27) are not applied yet.
 */
const ANNOUNCEMENT_COLUMN_SETS = [
  'id, title, content, category, created_at, updated_at, published_at, expires_at, pinned, is_published, image_url, excerpt',
  'id, title, content, category, created_at, updated_at, published_at, is_published, image_url, excerpt',
  'id, title, content, category, created_at, updated_at, is_published',
]

const ADMIN_ACCESS_ERROR = 'Admin access required.'

type ParsedTimestamp = { value: string | null; error: string | null }

/** Accepts ISO strings from the admin form; an empty value clears the field. */
function parseOptionalTimestamp(value: unknown, field: string): ParsedTimestamp {
  if (value === null || value === undefined || value === '') {
    return { value: null, error: null }
  }

  const time = Date.parse(String(value))
  if (Number.isNaN(time)) {
    return { value: null, error: `${field} is not a valid date and time.` }
  }

  return { value: new Date(time).toISOString(), error: null }
}

function generateExcerpt(content: string, maxLength = 200): string {
  const stripped = stripHtml(content)
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength) + '...'
}

function requestContext(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  }
}

/** Loads the fields needed to decide publish-state changes and image cleanup. */
async function fetchAnnouncement(adminClient: any, id: string) {
  const attempts = [
    'id, is_published, published_at, image_url',
    'id, is_published, image_url',
    'id, is_published',
  ]

  let lastError: any = null

  for (const columns of attempts) {
    const { data, error } = await adminClient
      .from('announcements')
      .select(columns)
      .eq('id', id)
      .maybeSingle()

    if (!error) return { data: data as any, error: null as any }
    lastError = error
    if (!isAnnouncementColumnError(error)) break
  }

  return { data: null as any, error: lastError }
}

/** Writes with the optional columns first, retrying without them when absent. */
async function writeAnnouncement(
  adminClient: any,
  payload: Record<string, unknown>,
  optionalColumns: Record<string, unknown>,
  id?: string,
) {
  const attempts = [{ ...payload, ...optionalColumns }, payload]

  let lastError: any = null

  for (const attempt of attempts) {
    const { data, error } = id
      ? await adminClient.from('announcements').update(attempt).eq('id', id).select()
      : await adminClient.from('announcements').insert(attempt).select()

    if (!error) return { data: data as any[] | null, error: null as any }
    lastError = error
    if (!isAnnouncementColumnError(error)) break
  }

  return { data: null as any[] | null, error: lastError }
}

/** Recovers the storage object path from a public bucket URL. */
function extractAnnouncementImagePath(url: string | null | undefined): string | null {
  if (!url) return null

  const marker = `/storage/v1/object/public/${ANNOUNCEMENT_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null

  const path = url.slice(index + marker.length).split('?')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** Best-effort cleanup so replacing/deleting an announcement cannot leak files. */
async function removeAnnouncementImage(adminClient: any, url: string | null | undefined) {
  const path = extractAnnouncementImagePath(url)
  if (!path) return

  const { error } = await adminClient.storage.from(ANNOUNCEMENT_BUCKET).remove([path])
  if (error) {
    logger.warn('Failed to remove announcement image from storage', {
      context: 'api/announcements',
      path,
      message: error.message,
    })
  }
}

export async function GET(request: NextRequest) {
  const user = await getAdminFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: ADMIN_ACCESS_ERROR }, { status: 403 })
  }

  const adminClient = createAdminClient()

  // Ordered pinned-first so the admin list matches the citizen feed. Only the
  // richest column set can order by `pinned`.
  const attempts = ANNOUNCEMENT_COLUMN_SETS.map((columns, index) => () => {
    const query = adminClient.from('announcements').select(columns)

    return index === 0
      ? query.order('pinned', { ascending: false }).order('created_at', { ascending: false })
      : query.order('created_at', { ascending: false })
  })

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
    logger.error('Error fetching announcements', lastError, { context: 'api/announcements' })
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
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getAdminFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: ADMIN_ACCESS_ERROR }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = createAnnouncementSchema.parse(body)

    const adminClient = createAdminClient()

    const sanitizedContent = sanitizeRichText(validated.content)
    if (stripHtml(sanitizedContent) === '') {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
    }

    const publishAt = parseOptionalTimestamp(validated.publish_at, 'Publish date')
    if (publishAt.error) {
      return NextResponse.json({ error: publishAt.error }, { status: 400 })
    }

    const expiresAt = parseOptionalTimestamp(validated.expires_at, 'Expiry date')
    if (expiresAt.error) {
      return NextResponse.json({ error: expiresAt.error }, { status: 400 })
    }

    const now = new Date().toISOString()
    // An empty publish date means "publish now"; a future one schedules it.
    const publishedAt = validated.is_published ? publishAt.value ?? now : null
    const expiresAtTime = expiresAt.value ? Date.parse(expiresAt.value) : null

    if (expiresAtTime !== null && expiresAtTime <= (publishedAt ? Date.parse(publishedAt) : Date.now())) {
      return NextResponse.json(
        { error: 'Expiry must be after the publish date and time.' },
        { status: 400 },
      )
    }

    const finalExcerpt = validated.excerpt?.trim() || generateExcerpt(sanitizedContent)

    const { data, error } = await writeAnnouncement(
      adminClient,
      {
        title: validated.title,
        content: sanitizedContent,
        category: validated.category,
        is_published: validated.is_published,
        updated_at: now,
      },
      {
        image_url: validated.image_url || null,
        excerpt: finalExcerpt,
        published_at: publishedAt,
        expires_at: expiresAt.value,
        pinned: validated.pinned ?? false,
      },
    )

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

  const user = await getAdminFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: ADMIN_ACCESS_ERROR }, { status: 403 })
  }

  try {
    const body = await request.json()
    const adminClient = createAdminClient()

    // The Manage table's publish/unpublish toggle only sends { id, is_published },
    // so it is handled separately instead of failing full-update validation.
    const isPublishStateUpdate =
      typeof body?.is_published === 'boolean' &&
      body?.title === undefined &&
      body?.content === undefined &&
      body?.category === undefined

    if (isPublishStateUpdate) {
      const validated = setAnnouncementPublishStateSchema.parse(body)
      const { data: existing, error: existingError } = await fetchAnnouncement(adminClient, validated.id)

      if (existingError) {
        logger.error('Error loading announcement for publish toggle', existingError, { context: 'api/announcements' })
        return NextResponse.json({ error: existingError.message || 'Failed to update announcement' }, { status: 500 })
      }

      if (!existing) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 })
      }

      const now = new Date().toISOString()

      const { data, error } = await writeAnnouncement(
        adminClient,
        { is_published: validated.is_published, updated_at: now },
        { published_at: validated.is_published ? existing.published_at || now : null },
        validated.id,
      )

      if (error) {
        logger.error('Error updating announcement status', error, { context: 'api/announcements' })
        return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
      }

      await logAuditAction({
        adminId: user.id,
        adminEmail: user.email ?? undefined,
        action: validated.is_published ? 'announcement_published' : 'announcement_unpublished',
        resourceType: 'announcement',
        resourceId: validated.id,
        newValues: { is_published: validated.is_published },
        ...requestContext(request),
      })

      return NextResponse.json({ announcement: data?.[0] || null })
    }

    const validated = updateAnnouncementSchema.parse(body)

    const sanitizedContent = sanitizeRichText(validated.content)
    if (stripHtml(sanitizedContent) === '') {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await fetchAnnouncement(adminClient, validated.id)

    if (existingError) {
      logger.error('Error loading announcement before update', existingError, { context: 'api/announcements' })
      return NextResponse.json({ error: existingError.message || 'Failed to update announcement' }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 })
    }

    const publishAt = parseOptionalTimestamp(validated.publish_at, 'Publish date')
    if (publishAt.error) {
      return NextResponse.json({ error: publishAt.error }, { status: 400 })
    }

    const expiresAt = parseOptionalTimestamp(validated.expires_at, 'Expiry date')
    if (expiresAt.error) {
      return NextResponse.json({ error: expiresAt.error }, { status: 400 })
    }

    const now = new Date().toISOString()
    const nextImageUrl = validated.image_url || null
    // The edit form pre-fills the current publish time, so an empty value here
    // means the admin deliberately asked to publish immediately.
    const publishedAt = validated.is_published ? publishAt.value ?? now : null
    const expiresAtTime = expiresAt.value ? Date.parse(expiresAt.value) : null

    if (expiresAtTime !== null && expiresAtTime <= (publishedAt ? Date.parse(publishedAt) : Date.now())) {
      return NextResponse.json(
        { error: 'Expiry must be after the publish date and time.' },
        { status: 400 },
      )
    }

    const finalExcerpt = validated.excerpt?.trim() || generateExcerpt(sanitizedContent)

    const { data, error } = await writeAnnouncement(
      adminClient,
      {
        title: validated.title,
        content: sanitizedContent,
        category: validated.category,
        is_published: validated.is_published,
        updated_at: now,
      },
      {
        image_url: nextImageUrl,
        excerpt: finalExcerpt,
        published_at: publishedAt,
        expires_at: expiresAt.value,
        pinned: validated.pinned ?? false,
      },
      validated.id,
    )

    if (error) {
      logger.error('Error updating announcement', error, { context: 'api/announcements' })
      return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
    }

    // The row now points at the new image, so the replaced one is safe to drop.
    if (existing.image_url && existing.image_url !== nextImageUrl) {
      await removeAnnouncementImage(adminClient, existing.image_url)
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

  const user = await getAdminFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: ADMIN_ACCESS_ERROR }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = deleteAnnouncementSchema.parse(body)

    const adminClient = createAdminClient()

    const { data: existing } = await fetchAnnouncement(adminClient, validated.id)

    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', validated.id)

    if (error) {
      logger.error('Error deleting announcement', error, { context: 'api/announcements' })
      return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
    }

    await removeAnnouncementImage(adminClient, existing?.image_url)

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