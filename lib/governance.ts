export const designationCategories = ['barangay', 'sk', 'staff'] as const

export type DesignationCategory = (typeof designationCategories)[number]

export const officialStatuses = ['active', 'archived'] as const

export type OfficialStatus = (typeof officialStatuses)[number]

export const designationCategoryLabels: Record<DesignationCategory, string> = {
  barangay: 'Barangay Officials',
  sk: 'SK Officials',
  staff: 'Staff',
}

export const designationCategoryShortLabels: Record<DesignationCategory, string> = {
  barangay: 'Barangay',
  sk: 'SK',
  staff: 'Staff',
}

export function getDesignationCategoryLabel(category: string | null | undefined) {
  if (category && category in designationCategoryLabels) {
    return designationCategoryLabels[category as DesignationCategory]
  }

  return 'Unknown'
}

export function getDesignationCategoryShortLabel(category: string | null | undefined) {
  if (category && category in designationCategoryShortLabels) {
    return designationCategoryShortLabels[category as DesignationCategory]
  }

  return 'Unknown'
}

export function getOfficialStatusLabel(status: string | null | undefined) {
  if (status === 'archived') return 'Archived'
  return 'Active'
}

export function getOfficialTermDuration(termStart?: string | null, termEnd?: string | null) {
  if (!termStart || !termEnd) {
    return 'N/A'
  }

  const formatDate = (d: string) => d.slice(0, 10).replaceAll('-', '/')
  return `${formatDate(termStart)} - ${formatDate(termEnd)}`
}

/**
 * Badge color per designation CATEGORY (migration 43).
 *
 * This used to be a hand-picked `badge_color` column, which invited arbitrary
 * values nobody could justify - the seeded barangay set was four unrelated
 * shades (dark green, green, teal, sky blue) that implied a distinction that
 * does not exist in practice. Color is therefore derived from the category
 * alone, so the only thing it encodes is the grouping that is actually real.
 */
export const designationCategoryBadgeColors: Record<DesignationCategory, string> = {
  barangay: '#166534',
  sk: '#7c3aed',
  staff: '#6b7280',
}

/**
 * The badge color for a designation, derived from its category. Unknown or
 * missing categories fall back to the staff gray rather than the old default
 * green, so an unmapped category is visibly neutral instead of pretending to
 * be a barangay official.
 */
export function getDesignationBadgeColor(category?: string | null): string {
  if (category && category in designationCategoryBadgeColors) {
    return designationCategoryBadgeColors[category as DesignationCategory]
  }

  return designationCategoryBadgeColors.staff
}

/**
 * Anything with a category and a rank - the shape returned by every query that
 * joins `designations`, and the shape used by the admin forms.
 *
 * Named `rank`, not `priority`: `requests.priority` and
 * `complaints.priority_level` are per-item triage urgency, which is a different
 * concept from the standing rank of an office (migration 42).
 */
export interface RankedDesignationLike {
  category: string
  rank?: number | null
  id?: string | null
}

/**
 * The rank a new designation should get: one past the highest rank already used
 * in that category (migration 42). Returns 1 for an empty category.
 *
 * Ranking is per category, so a new SK designation does not have to outrank the
 * whole barangay list, and gaps left by deleted designations are not reused.
 */
export function getNextRank(
  designations: readonly RankedDesignationLike[],
  category: string,
): number {
  let highest = 0

  for (const designation of designations) {
    if (designation.category !== category) continue

    const rank = Number(designation.rank)
    if (Number.isFinite(rank) && rank > highest) {
      highest = rank
    }
  }

  return highest + 1
}

/**
 * Whether `rank` is already taken in `category`, ignoring the designation being
 * edited. Mirrors the UNIQUE (category, rank) constraint so the form can report
 * a clash before the insert fails.
 *
 * Returns false when the rank is blank - callers treat blank as "auto-assign",
 * which cannot collide because it is derived from the current maximum.
 */
export function isRankTaken(
  designations: readonly RankedDesignationLike[],
  category: string,
  rank: number | string | null | undefined,
  options: { excludeId?: string | null; exclude?: readonly { id?: string | null }[] } = {},
): boolean {
  if (rank === null || rank === undefined) return false

  const candidate = Number(typeof rank === 'string' && rank.trim() === '' ? Number.NaN : rank)
  if (!Number.isFinite(candidate)) return false

  const excluded = new Set<string>()
  if (options.excludeId) excluded.add(options.excludeId)
  for (const item of options.exclude ?? []) {
    if (item.id) excluded.add(item.id)
  }

  return designations.some((designation) => {
    if (excluded.has(designation.id ?? '')) return false
    if (designation.category !== category) return false
    return Number(designation.rank) === candidate
  })
}

export function isCaptainDesignation(name?: string | null) {
  return Boolean(name && name.toLowerCase().includes('barangay captain'))
}
