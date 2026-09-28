/**
 * Single source of truth for which barangay this deployment serves.
 *
 * Deliberately dependency-free (no zod, no app imports) so that copy, metadata,
 * server actions and client components can all read the same constants without
 * dragging a validation library into their bundle. `lib/schemas.ts` re-exports
 * everything here, so `@/lib/schemas` remains a valid import.
 */

/**
 * LingkodBayan is deployed for a single service area, so the barangay is a
 * fixed system constant instead of a user-selectable list. Barangay Barretto
 * (Olongapo City) is the only barangay this system serves — residents are
 * registered under it automatically and never choose it in a dropdown.
 */
export const BARANGAY_NAME = 'Barretto'
export const BARANGAY_DISPLAY_NAME = 'Barangay Barretto'
export const BARANGAY_CITY = 'Olongapo City'
export const BARANGAY_PROVINCE = 'Zambales'
export const BARANGAY_FULL_LABEL = `${BARANGAY_DISPLAY_NAME}, ${BARANGAY_CITY}`

export type BarangayName = typeof BARANGAY_NAME

/**
 * Canonicalizes a barangay value that arrives from an admin form, a CSV import,
 * or a legacy record.
 *
 * Blank input and any spelling of Barretto ("Barretto", "Barangay Barretto",
 * "Brgy. Barretto") resolve to `BARANGAY_NAME`, keeping stored values canonical.
 * A value that points at a barangay this deployment does not serve resolves to
 * `null`, so callers can reject that record instead of importing it.
 */
export function canonicalBarangayName(value: string | null | undefined): BarangayName | null {
  const cleaned = (value ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (!cleaned || cleaned === 'barretto' || cleaned === 'barangaybarretto' || cleaned === 'brgybarretto') {
    return BARANGAY_NAME
  }
  return null
}

/**
 * Whether a stored barangay value belongs to this deployment's service area.
 *
 * Used to ignore records that were imported before the system became
 * Barangay-Barretto-only (and any row that slips in outside the app), so they
 * can never influence identity matching or verification.
 */
export function isInServiceArea(value: string | null | undefined): boolean {
  return canonicalBarangayName(value) !== null
}
