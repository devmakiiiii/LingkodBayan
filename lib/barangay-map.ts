/**
 * Geographic configuration for the single barangay this deployment serves.
 *
 * The complaint maps — the citizen location picker, the complaint detail map
 * and the admin analytics map — all need the same centre, boundary and tile
 * source so they stay locked to Barangay Barretto. Keeping the numbers here
 * means a boundary change is a one-line edit instead of a hunt through client
 * components.
 *
 * Like `lib/barangay.ts`, this module is deliberately dependency-free (no
 * Leaflet, no React) so it can be imported from server code, client components
 * and unit tests alike.
 */

import barangayBarrettoJson from './barangay-barretto.ts'

export const BARANGAY_MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const BARANGAY_MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * Barangay Barretto boundary (OpenStreetMap relation 15466785) as GeoJSON.
 *
 * Imported rather than fetched so containment checks can run synchronously
 * inside a Leaflet click handler, and so one document drives both the boundary
 * overlay and the guard below. Positions are `[lng, lat]` per the GeoJSON spec.
 */
export const BARANGAY_BARRETTO_BOUNDARY = barangayBarrettoJson

/** Centre of Barangay Barretto, Olongapo City ([lat, lng]). */
export const BARANGAY_BARRETTO_CENTER: [number, number] = [14.851, 120.2631]

/**
 * Bounding box of the Barangay Barretto boundary (OpenStreetMap relation
 * 15466785), expressed as the south-west and north-east corners in Leaflet
 * [lat, lng] order.
 */
export const BARANGAY_BARRETTO_BOUNDS: [[number, number], [number, number]] = [
  [14.831867, 120.234189],
  [14.887837, 120.289274],
]

/**
 * Soft pad (≈300 m) added around `BARANGAY_BARRETTO_BOUNDS` for the maps'
 * `maxBounds`, so the boundary line and edge markers stay comfortably inside
 * the viewport while panning is still clamped to the barangay.
 */
const BOUNDS_PADDING_DEGREES = 0.003

export const BARANGAY_BARRETTO_MAX_BOUNDS: [[number, number], [number, number]] = [
  [
    BARANGAY_BARRETTO_BOUNDS[0][0] - BOUNDS_PADDING_DEGREES,
    BARANGAY_BARRETTO_BOUNDS[0][1] - BOUNDS_PADDING_DEGREES,
  ],
  [
    BARANGAY_BARRETTO_BOUNDS[1][0] + BOUNDS_PADDING_DEGREES,
    BARANGAY_BARRETTO_BOUNDS[1][1] + BOUNDS_PADDING_DEGREES,
  ],
]

/** Zoom window that keeps a map at barangay / purok scale. */
export const BARANGAY_BARRETTO_MIN_ZOOM = 12
export const BARANGAY_BARRETTO_MAX_ZOOM = 19
/** Zoom used when a map opens with no more specific target. */
export const BARANGAY_BARRETTO_DEFAULT_ZOOM = 15

/** A GeoJSON ring: a closed loop of `[lng, lat]` positions. */
type Ring = number[][]
/** A GeoJSON polygon: ring 0 is the outer edge, any further rings are holes. */
type Polygon = Ring[]
/** A GeoJSON multi-polygon: a list of polygons. */
type MultiPolygon = Polygon[]

const BARANGAY_BARRETTO_POLYGONS: MultiPolygon =
  barangayBarrettoJson.features[0]?.geometry.coordinates ?? []

/** Ray-casting (Jordan curve) test of a point against one closed ring. */
function isPointInRing(ring: Ring, latitude: number, longitude: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function isPointInPolygon(polygon: Polygon, latitude: number, longitude: number): boolean {
  if (!isPointInRing(polygon[0], latitude, longitude)) return false
  for (let hole = 1; hole < polygon.length; hole++) {
    if (isPointInRing(polygon[hole], latitude, longitude)) return false
  }
  return true
}

/**
 * Containment test used to reject complaint pins dropped outside Barangay
 * Barretto.
 *
 * The bounding box on its own is only an approximation — its corners reach into
 * Subic Bay and neighbouring barangays — so the box is used as a cheap
 * pre-filter and the real boundary polygon then decides the outcome.
 */
export function isWithinBarangayBarretto(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false

  const [[south, west], [north, east]] = BARANGAY_BARRETTO_BOUNDS
  if (latitude < south || latitude > north || longitude < west || longitude > east) return false

  return BARANGAY_BARRETTO_POLYGONS.some((polygon) => isPointInPolygon(polygon, latitude, longitude))
}
