/**
 * Shared announcement rules used by the admin portal, the API routes and the
 * citizen views.
 *
 * Visibility is derived from timestamps rather than a background job:
 * `published_at` doubles as the schedule (a future value means "publish later")
 * and `expires_at` hides time-bound notices automatically. That keeps scheduled
 * publishing correct without a cron entry, which would otherwise have to be kept
 * in sync with reality.
 */

export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'expired'

export type AnnouncementSchedule = {
  is_published?: boolean | null
  published_at?: string | null
  expires_at?: string | null
}

/** Columns added by later migrations; reads degrade when they are absent. */
export const OPTIONAL_ANNOUNCEMENT_COLUMNS = [
  'image_url',
  'excerpt',
  'published_at',
  'expires_at',
  'pinned',
] as const

/**
 * True when a PostgREST error is caused by one of the optional columns not
 * existing yet (i.e. the migration has not been applied to that database).
 */
export function isAnnouncementColumnError(
  error: unknown,
  columns: readonly string[] = OPTIONAL_ANNOUNCEMENT_COLUMNS,
): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? '')
  return columns.some((column) => message.includes(column))
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

/**
 * Drafts were never published; scheduled ones go live later; expired ones have
 * passed their expiry. Anything else is live right now.
 */
export function getAnnouncementStatus(
  announcement: AnnouncementSchedule,
  now: Date = new Date(),
): AnnouncementStatus {
  if (!announcement.is_published) return 'draft'

  const nowTime = now.getTime()

  const expiresAt = toTime(announcement.expires_at)
  if (expiresAt !== null && expiresAt <= nowTime) return 'expired'

  const publishedAt = toTime(announcement.published_at)
  if (publishedAt !== null && publishedAt > nowTime) return 'scheduled'

  return 'published'
}

/** Residents only ever see `published` announcements. */
export function isAnnouncementVisible(
  announcement: AnnouncementSchedule,
  now: Date = new Date(),
): boolean {
  return getAnnouncementStatus(announcement, now) === 'published'
}

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  expired: 'Expired',
}

export const ANNOUNCEMENT_STATUS_CLASSES: Record<AnnouncementStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20',
  scheduled: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  published: 'bg-primary/10 text-primary border-primary/20',
  expired: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
}

/** Formats a timestamp for a `datetime-local` input in the viewer's timezone. */
export function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
