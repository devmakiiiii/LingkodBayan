/**
 * Address helpers for complaint location pinning.
 *
 * The location picker asks OpenStreetMap's Nominatim service to reverse
 * geocode the point a resident taps. Nominatim answers with a nested `address`
 * object plus a long `display_name`. These helpers turn that into a tidy,
 * single-line Philippine address for Barangay Barretto and provide a coordinate
 * fallback when the service has nothing useful to say.
 *
 * Dependency-free (no React, no Leaflet, no zod) so it can be unit tested with
 * Node's built-in test runner, mirroring `lib/barangay.ts`.
 */
import {
  BARANGAY_CITY,
  BARANGAY_DISPLAY_NAME,
  BARANGAY_NAME,
  BARANGAY_PROVINCE,
  canonicalBarangayName,
} from './barangay.ts'

/** Subset of Nominatim's `address` object that we read. */
export interface NominatimAddress {
  house_number?: string | null
  road?: string | null
  pedestrian?: string | null
  footway?: string | null
  neighbourhood?: string | null
  suburb?: string | null
  quarter?: string | null
  village?: string | null
  city?: string | null
  town?: string | null
  municipality?: string | null
  state?: string | null
  region?: string | null
  postcode?: string | null
  country?: string | null
  [key: string]: string | null | undefined
}

/** Shape of the Nominatim reverse-geocoding response we care about. */
export interface NominatimReverseResult {
  display_name?: string | null
  address?: NominatimAddress | null
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** Joins address parts with ", ", dropping blanks and case-insensitive repeats. */
function joinParts(parts: string[]): string {
  const seen = new Set<string>()
  return parts
    .filter((part) => {
      if (!part) return false
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(', ')
}

/** Human-readable coordinate fallback, e.g. `14.851000, 120.263100`. */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

/** A picked address split into the editable part and the derived localities. */
export interface PickedAddress {
  /** House number, street and purok — the part only a resident can confirm. */
  street: string
  /** Barangay / city / province / postcode — derived, never resident-typed. */
  localities: string
  /** Everything on one line; what the map popup shows. */
  full: string
}

/**
 * Builds the address for a pinned point, split so the complaint form can show
 * the street separately from the fixed localities.
 *
 * Prefers what the reverse geocoder reports, and normalises it to the
 * deployment's own wording — "Barangay Barretto, Olongapo City, Zambales" —
 * when the response agrees the point is in Barangay Barretto or names no
 * barangay at all. When it names a different barangay (which can happen right
 * on the boundary), OSM's own labels are reported instead of relabelling the
 * point as Barretto.
 *
 * Falls back to Nominatim's `display_name`, then to the callers' `fallback`
 * (usually the coordinates) when there is nothing usable to compose.
 */
export function describePickedAddress(
  result: NominatimReverseResult | null | undefined,
  fallback: string,
): PickedAddress {
  const address = result?.address
  const displayName = clean(result?.display_name)

  if (!address) {
    // No structured response: there is no street to offer, so the whole line
    // lands in the localities bucket and the resident supplies the street.
    const full = displayName || fallback
    return { street: '', localities: full, full }
  }

  const streetLine = [
    clean(address.house_number),
    clean(address.road) || clean(address.pedestrian) || clean(address.footway),
  ]
    .filter(Boolean)
    .join(' ')

  // Nominatim sometimes reports the barangay under `quarter`, `village` or
  // `suburb`; treat a "suburb" that is really the barangay as the barangay
  // rather than a purok, so it doesn't show up twice.
  const purokCandidate = clean(address.neighbourhood) || clean(address.suburb)
  const purok = canonicalBarangayName(purokCandidate) === BARANGAY_NAME ? '' : purokCandidate

  const barangay = clean(address.quarter) || clean(address.village) || clean(address.suburb)
  const city = clean(address.city) || clean(address.town) || clean(address.municipality)
  const province = clean(address.state) || clean(address.province)
  const postcode = clean(address.postcode)

  // Normalise to the deployment's barangay only when the reverse geocoder
  // agrees (it names Barretto) or stays silent. If it names a different
  // barangay — which happens right on the boundary — report what OSM found
  // instead of relabelling the point as Barretto.
  const resolvedElsewhere = Boolean(barangay) && canonicalBarangayName(barangay) !== BARANGAY_NAME

  const street = joinParts([streetLine, purok])
  const localities = joinParts(
    resolvedElsewhere
      ? [barangay, city, province, postcode]
      : [BARANGAY_DISPLAY_NAME, BARANGAY_CITY, BARANGAY_PROVINCE, postcode],
  )
  const full = joinParts(
    resolvedElsewhere
      ? [streetLine, purok, barangay, city, province, postcode]
      : [streetLine, purok, BARANGAY_DISPLAY_NAME, BARANGAY_CITY, BARANGAY_PROVINCE, postcode],
  )

  return { street, localities, full }
}

/** Single-line convenience wrapper over {@link describePickedAddress}. */
export function formatPickedAddress(
  result: NominatimReverseResult | null | undefined,
  fallback: string,
): string {
  return describePickedAddress(result, fallback).full
}
