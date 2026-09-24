/**
 * Single source of truth for announcement categories and their badge colours.
 *
 * Previously duplicated across the admin page, the citizen list, the citizen
 * detail page and the dashboard card, which risked the admin picker offering a
 * category the citizen views had no colour for.
 */
export const ANNOUNCEMENT_CATEGORIES = ['Event', 'Update', 'Alert', 'Maintenance', 'News'] as const

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

const CATEGORY_COLORS: Record<string, string> = {
  event: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  update: 'bg-primary/10 text-primary border-primary/20',
  alert: 'bg-red-500/10 text-red-700 border-red-500/20',
  maintenance: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  news: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
}

const FALLBACK_COLOR = 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20'

export function getAnnouncementCategoryColor(category: string | null | undefined): string {
  if (!category) return FALLBACK_COLOR
  return CATEGORY_COLORS[category.toLowerCase()] ?? FALLBACK_COLOR
}
