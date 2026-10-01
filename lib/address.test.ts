/**
 * Unit tests for the complaint address formatter.
 *
 * The location picker stores whatever `formatPickedAddress` returns as the
 * complaint's `location_address`, so these tests lock the shape residents and
 * admins will read.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/address.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { describePickedAddress, formatCoordinates, formatPickedAddress } from './address.ts'

describe('formatCoordinates', () => {
  it('renders six decimal places', () => {
    assert.equal(formatCoordinates(14.851, 120.2631), '14.851000, 120.263100')
  })
})

describe('formatPickedAddress', () => {
  it('composes a full barangay address from Nominatim components', () => {
    const address = formatPickedAddress(
      {
        display_name: '2 Khoolets Store, 69, Zambales Highway, Barretto, Olongapo, Central Luzon, 2200, Philippines',
        address: {
          shop: '2 Khoolets Store',
          house_number: '69',
          road: 'Zambales Highway',
          quarter: 'Barretto',
          city: 'Olongapo',
          region: 'Central Luzon',
          postcode: '2200',
          country: 'Philippines',
        },
      },
      '14.851000, 120.263100',
    )

    assert.equal(
      address,
      '69 Zambales Highway, Barangay Barretto, Olongapo City, Zambales, 2200',
    )
  })

  it('includes the purok/neighbourhood when present', () => {
    const address = formatPickedAddress(
      {
        address: {
          road: 'Rizal Street',
          neighbourhood: 'Purok 5',
          quarter: 'Barretto',
        },
      },
      'fallback',
    )

    assert.equal(
      address,
      'Rizal Street, Purok 5, Barangay Barretto, Olongapo City, Zambales',
    )
  })

  it('keeps the canonical Barretto wording when the response names Barretto', () => {
    const address = formatPickedAddress(
      {
        display_name: 'Barretto, Olongapo, Central Luzon, 2200, Philippines',
        address: { quarter: 'Barretto', city: 'Olongapo', postcode: '2200' },
      },
      'fallback',
    )

    assert.equal(address, 'Barangay Barretto, Olongapo City, Zambales, 2200')
  })

  it('defaults to the canonical barangay when the response names no barangay', () => {
    const address = formatPickedAddress(
      { address: { city: 'Olongapo', postcode: '2200' } },
      'fallback',
    )

    assert.equal(address, 'Barangay Barretto, Olongapo City, Zambales, 2200')
  })

  it('reports OSM labels when the point resolves to another barangay', () => {
    const address = formatPickedAddress(
      {
        display_name: 'Magdalena Subdivision, Santo Tomas, Subic, Zambales, Central Luzon, 2209, Philippines',
        address: {
          neighbourhood: 'Magdalena Subdivision',
          suburb: 'Santo Tomas',
          town: 'Subic',
          state: 'Zambales',
          postcode: '2209',
        },
      },
      'fallback',
    )

    assert.equal(address, 'Magdalena Subdivision, Santo Tomas, Subic, Zambales, 2209')
  })

  it('deduplicates repeated parts', () => {
    const address = formatPickedAddress(
      {
        address: {
          road: 'Rizal Street',
          neighbourhood: 'Barangay Barretto',
          quarter: 'Barretto',
        },
      },
      'fallback',
    )

    assert.equal(
      address,
      'Rizal Street, Barangay Barretto, Olongapo City, Zambales',
    )
  })

  it('falls back to the provided coordinates when nothing is resolvable', () => {
    assert.equal(formatPickedAddress({ address: null }, '14.851000, 120.263100'), '14.851000, 120.263100')
    assert.equal(formatPickedAddress(null, '14.851000, 120.263100'), '14.851000, 120.263100')
    assert.equal(formatPickedAddress(undefined, '14.851000, 120.263100'), '14.851000, 120.263100')
  })
})

describe('describePickedAddress', () => {
  it('splits the resident-editable street from the derived localities', () => {
    const picked = describePickedAddress(
      {
        address: { house_number: '69', road: 'Zambales Highway', quarter: 'Barretto', postcode: '2200' },
      },
      'fallback',
    )

    assert.equal(picked.street, '69 Zambales Highway')
    assert.equal(picked.localities, 'Barangay Barretto, Olongapo City, Zambales, 2200')
    assert.equal(picked.full, '69 Zambales Highway, Barangay Barretto, Olongapo City, Zambales, 2200')
  })

  it('leaves the street empty when map data has no street detail', () => {
    const picked = describePickedAddress(
      { address: { quarter: 'Barretto', postcode: '2200' } },
      '14.851000, 120.263100',
    )

    assert.equal(picked.street, '')
    assert.equal(picked.localities, 'Barangay Barretto, Olongapo City, Zambales, 2200')
  })

  it('exposes no street when nothing is resolvable', () => {
    const picked = describePickedAddress(null, '14.851000, 120.263100')

    assert.equal(picked.street, '')
    assert.equal(picked.full, '14.851000, 120.263100')
  })
})
