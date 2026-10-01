/**
 * Unit tests for the Barangay Barretto map configuration.
 *
 * The complaint maps (picker, detail view, admin analytics) must stay locked to
 * Barangay Barretto, so these tests pin the invariants they rely on: the centre
 * falls inside the boundary, the bounding box is well formed, and stray
 * coordinates are rejected by the containment guard.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/barangay-map.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BARANGAY_BARRETTO_BOUNDS,
  BARANGAY_BARRETTO_CENTER,
  BARANGAY_BARRETTO_MAX_BOUNDS,
  isWithinBarangayBarretto,
} from './barangay-map.ts'

describe('Barangay Barretto map configuration', () => {
  it('places the centre inside the barangay boundary', () => {
    const [latitude, longitude] = BARANGAY_BARRETTO_CENTER
    assert.equal(isWithinBarangayBarretto(latitude, longitude), true)
  })

  it('orders the bounding box south-west then north-east', () => {
    const [[south, west], [north, east]] = BARANGAY_BARRETTO_BOUNDS
    assert.ok(south < north, 'south must sit below north')
    assert.ok(west < east, 'west must sit left of east')
  })

  it('pads maxBounds around the barangay boundary', () => {
    const [[south, west], [north, east]] = BARANGAY_BARRETTO_BOUNDS
    const [[maxSouth, maxWest], [maxNorth, maxEast]] = BARANGAY_BARRETTO_MAX_BOUNDS
    assert.ok(maxSouth < south && maxWest < west, 'max bounds extend past the south-west corner')
    assert.ok(maxNorth > north && maxEast > east, 'max bounds extend past the north-east corner')
  })

  it('accepts the barangay centre and rejects off-island coordinates', () => {
    assert.equal(isWithinBarangayBarretto(14.851, 120.2631), true)
    // Metro Manila is well outside the barangay.
    assert.equal(isWithinBarangayBarretto(14.5995, 120.9842), false)
    // Just south-west of the boundary corner.
    assert.equal(isWithinBarangayBarretto(14.83, 120.23), false)
  })

  it('accepts a real Barangay Barretto landmark (Baloy Beach)', () => {
    assert.equal(isWithinBarangayBarretto(14.8485578, 120.2529368), true)
  })

  it('rejects points inside the bounding box but outside the boundary', () => {
    // Both sit inside BARANGAY_BARRETTO_BOUNDS, so a bbox-only guard would have
    // wrongly accepted them — the polygon is what excludes them.
    assert.equal(isWithinBarangayBarretto(14.845, 120.26), false)
    // Nominatim reports this point as Santo Tomas, Subic (ZIP 2209).
    assert.equal(isWithinBarangayBarretto(14.8555, 120.255), false)
  })

  it('rejects non-finite input', () => {
    assert.equal(isWithinBarangayBarretto(Number.NaN, 120.2631), false)
    assert.equal(isWithinBarangayBarretto(14.851, Number.POSITIVE_INFINITY), false)
  })
})
