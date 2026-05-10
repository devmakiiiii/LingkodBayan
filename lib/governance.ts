export const designationCategories = ['barangay', 'sk', 'staff'] as const

export type DesignationCategory = (typeof designationCategories)[number]

export const officialStatuses = ['active', 'inactive'] as const

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
  return status === 'inactive' ? 'Inactive' : 'Active'
}

export function getOfficialTermDuration(termStart?: string | null, termEnd?: string | null) {
  if (!termStart || !termEnd) {
    return 'N/A'
  }

  const formatDate = (d: string) => d.slice(0, 10).replaceAll('-', '/')
  return `${formatDate(termStart)} - ${formatDate(termEnd)}`
}

export function normalizeBadgeColor(color?: string | null) {
  if (!color) {
    return '#28A745'
  }

  return color
}

export function isCaptainDesignation(name?: string | null) {
  return Boolean(name && name.toLowerCase().includes('barangay captain'))
}
