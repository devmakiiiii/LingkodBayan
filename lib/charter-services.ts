/**
 * Types and helpers for the Barangay Barretto Citizen's Charter 2025
 * (1st Edition) service catalog.
 *
 * Charter-sourced values (fees, processing times, requirements, steps) come
 * from migrations 22–23 and live on `service_categories`, `service_steps`,
 * and `service_category_requirements`. Everything here is display logic only —
 * it never invents charter data. When the charter does not specify a value,
 * helpers return the explicit fallback so the UI can say so honestly.
 */

export const NOT_SPECIFIED = 'Information not specified in the Citizen\u2019s Charter.'

export type ServiceCategoryType =
  | 'document'
  | 'appointment'
  | 'incident'
  | 'health'
  | 'emergency'
  | 'justice'
  | 'program'

export type ServiceFeeType =
  | 'free'
  | 'fixed'
  | 'range'
  | 'formula'
  | 'variable'
  | 'per_page'
  | 'unspecified'

export interface CharterService {
  id: string
  slug: string
  title: string
  description: string | null
  category_type: ServiceCategoryType
  is_active: boolean
  sort_order: number
  office_key: string | null
  classification: 'simple' | 'highly_technical' | null
  transaction_types: string[] | null
  who_may_avail: string | null
  fee_type: ServiceFeeType
  fee_amount_min: number | null
  fee_amount_max: number | null
  fee_description: string | null
  processing_time_text: string | null
  responsible_personnel: string | null
  charter_section: string | null
  directory_category: string | null
}

export interface ServiceStep {
  id: string
  step_number: number
  actor: 'client' | 'agency'
  description: string
}

export interface ServiceRequirement {
  id: string
  requirement_key: string
  requirement_label: string
  is_required: boolean
  sort_order: number
}

export interface Office {
  id: string
  office_key: string
  name: string
  charter_category: string | null
  address: string | null
  phone: string | null
  email: string | null
  facebook: string | null
  sort_order: number
  is_active: boolean
}

/** Public service directory groupings (order is display order). */
export const directoryCategories: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'documents-certifications', label: 'Documents & Certifications' },
  { value: 'business-property', label: 'Business & Property' },
  { value: 'health', label: 'Health Services' },
  { value: 'emergency-rescue', label: 'Emergency & Rescue' },
  { value: 'peace-security', label: 'Peace & Security' },
  { value: 'child-development', label: 'Child Development' },
  { value: 'education-training', label: 'Education & Training' },
  { value: 'complaints-feedback', label: 'Complaints & Feedback' },
]

export function getDirectoryCategoryLabel(value?: string | null): string {
  return directoryCategories.find((c) => c.value === value)?.label ?? 'General Services'
}

/** Category type tag shown on service cards. */
export function getServiceTypeLabel(categoryType: string): string {
  switch (categoryType) {
    case 'document': return 'Document'
    case 'appointment': return 'Appointment'
    case 'health': return 'Health Service'
    case 'emergency': return 'Emergency'
    case 'justice': return 'Justice'
    case 'program': return 'Program'
    default: return 'Service'
  }
}

const peso = (amount: number) =>
  `\u20B1${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`

/**
 * Compact fee label for cards and detail views. Prefers the charter's own
 * `fee_description` (which preserves exact wording) and falls back to the
 * structured amounts. Returns NOT_SPECIFIED when the charter is silent.
 */
export function formatServiceFee(service: {
  fee_type?: string | null
  fee_amount_min?: number | null
  fee_amount_max?: number | null
  fee_description?: string | null
}): string {
  switch (service.fee_type) {
    case 'free':
      return 'Free'
    case 'fixed':
      return service.fee_amount_min != null ? peso(service.fee_amount_min) : (service.fee_description ?? NOT_SPECIFIED)
    case 'range':
      if (service.fee_amount_min != null && service.fee_amount_max != null) {
        return `${peso(service.fee_amount_min)}–${peso(service.fee_amount_max)}`
      }
      return service.fee_description ?? NOT_SPECIFIED
    case 'formula':
    case 'per_page':
    case 'variable':
      return service.fee_description ?? NOT_SPECIFIED
    default:
      return NOT_SPECIFIED
  }
}

/** Compact processing time label, or the explicit not-specified fallback. */
export function formatProcessingTime(service: { processing_time_text?: string | null }): string {
  return service.processing_time_text ?? NOT_SPECIFIED
}

/** True when the service is an emergency service and must show hotline-first UX. */
export function isEmergencyService(service: { category_type?: string | null; office_key?: string | null }): boolean {
  return service.category_type === 'emergency' || service.office_key === 'bbfru' || service.office_key === 'bpat'
}
