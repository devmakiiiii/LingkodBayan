/**
 * Unit tests for automatic designation ranking (migration 42).
 *
 * The designation rank used to be a hand-typed `priority_order` that only
 * affected display sorting, so it drifted and duplicates within a category were
 * allowed. Migration 42 renames the column to `rank` (so it cannot be confused
 * with requests.priority / complaints.priority_level, which are per-item triage
 * urgency) and derives the value: blank means "max + 1 within this category",
 * with UNIQUE (category, rank) enforced in the database.
 *
 * These tests lock the two pure helpers that implement that, plus the schema rule
 * that a blank field is valid input rather than a 0.
 *
 * Run with Node's built-in test runner:
 *   node --test lib/designation-rank.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  designationCategories,
  getDesignationBadgeColor,
  getNextRank,
  isRankTaken,
  designationCategoryBadgeColors,
} from './governance.ts'
import { designationSchema } from './schemas.ts'

/** Mirrors the seeded rows after migration 42's dense renumbering. */
const seeded = [
  { id: 'd1', category: 'barangay', rank: 1 },
  { id: 'd2', category: 'barangay', rank: 2 },
  { id: 'd3', category: 'barangay', rank: 3 },
  { id: 'd4', category: 'barangay', rank: 4 },
  { id: 'd5', category: 'sk', rank: 1 },
  { id: 'd6', category: 'sk', rank: 2 },
  { id: 'd7', category: 'staff', rank: 1 },
]

describe('getNextRank', () => {
  it('returns 1 for an empty category', () => {
    assert.equal(getNextRank([], 'barangay'), 1)
  })

  it('returns max + 1 within the category', () => {
    assert.equal(getNextRank(seeded, 'barangay'), 5)
    assert.equal(getNextRank(seeded, 'sk'), 3)
    assert.equal(getNextRank(seeded, 'staff'), 2)
  })

  it('ignores ranks from other categories', () => {
    // Without per-category scoping, a new SK designation would be pushed to 8.
    assert.equal(getNextRank(seeded, 'sk'), 3)
    assert.equal(getNextRank(seeded, 'staff'), 2)
  })

  it('does not reuse gaps left by deleted designations', () => {
    const withGap = [
      { id: 'a', category: 'barangay', rank: 1 },
      { id: 'b', category: 'barangay', rank: 7 },
    ]

    assert.equal(getNextRank(withGap, 'barangay'), 8)
  })

  it('treats missing, null and non-numeric ranks as zero rather than crashing', () => {
    const messy = [
      { id: 'a', category: 'staff', rank: null },
      { id: 'b', category: 'staff' },
      { id: 'c', category: 'staff', rank: Number.NaN },
    ]

    assert.equal(getNextRank(messy, 'staff'), 1)
  })
})

describe('isRankTaken', () => {
  it('flags a rank already used in the same category', () => {
    assert.equal(isRankTaken(seeded, 'barangay', 3), true)
  })

  it('allows the same rank in a different category', () => {
    // Rank 1 is used by a Captain, a Chairperson and a Staff Member by design.
    assert.equal(isRankTaken(seeded, 'sk', 3), false)
    assert.equal(isRankTaken(seeded, 'staff', 2), false)
  })

  it('does not flag the designation being edited against its own rank', () => {
    assert.equal(isRankTaken(seeded, 'barangay', 2, { excludeId: 'd2' }), false)
    assert.equal(isRankTaken(seeded, 'barangay', 2), true)
  })

  it('never flags a blank rank, since auto-assign derives from the current maximum', () => {
    assert.equal(isRankTaken(seeded, 'barangay', null), false)
    assert.equal(isRankTaken(seeded, 'barangay', undefined), false)
    assert.equal(isRankTaken(seeded, 'barangay', ''), false)
  })
})

describe('getDesignationBadgeColor (migration 43)', () => {
  it('gives every category a color', () => {
    for (const category of designationCategories) {
      assert.match(getDesignationBadgeColor(category), /^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('distinguishes SK from barangay, which is the distinction that is real', () => {
    // SK and barangay officials are visually separate groups; staff are a third.
    assert.notEqual(getDesignationBadgeColor('sk'), getDesignationBadgeColor('barangay'))
    assert.notEqual(getDesignationBadgeColor('sk'), getDesignationBadgeColor('staff'))
    assert.notEqual(getDesignationBadgeColor('barangay'), getDesignationBadgeColor('staff'))
  })

  it('no longer invents a per-designation distinction inside a category', () => {
    // The old column gave Captain and Treasurer four unrelated shades. Now every
    // barangay role shares one color, so the badge only encodes real grouping.
    assert.equal(
      getDesignationBadgeColor('barangay'),
      getDesignationBadgeColor('barangay'),
    )
    assert.equal(designationCategoryBadgeColors.barangay, '#166534')
  })

  it('falls back to the neutral staff color for unknown or missing categories', () => {
    // Deliberately NOT the old #28A745 default: an unmapped category should look
    // neutral rather than masquerading as a barangay official.
    assert.equal(getDesignationBadgeColor('municipal'), designationCategoryBadgeColors.staff)
    assert.equal(getDesignationBadgeColor(null), designationCategoryBadgeColors.staff)
    assert.equal(getDesignationBadgeColor(undefined), designationCategoryBadgeColors.staff)
  })
})

describe('designationSchema no longer stores a badge color', () => {
  it('accepts a designation with no badgeColor field at all', () => {
    const parsed = designationSchema.parse({ name: 'Barangay Captain', category: 'barangay' })
    // The field is absent from the schema entirely, which is why TypeScript
    // rejects `parsed.badgeColor` - that is the compile-time proof it is gone.
    assert.equal('badgeColor' in parsed, false)
  })

  it('drops a stale badgeColor instead of carrying it through', () => {
    // Zod objects strip unknown keys, so a legacy caller still sending the
    // field gets a clean record rather than an unexpected value.
    const parsed = designationSchema.parse({ name: 'Barangay Captain', category: 'barangay', badgeColor: '#ff0000' })
    assert.equal('badgeColor' in parsed, false)
    assert.equal(Object.keys(parsed).length, 2)
  })
})

describe('designationSchema rank', () => {
  const base = { name: 'Barangay Captain', category: 'barangay' }

  it('accepts a blank field and normalises it to undefined (auto-assign)', () => {
    const parsed = designationSchema.parse({ ...base, rank: '' })
    assert.equal(parsed.rank, undefined)
  })

  it('accepts an omitted field', () => {
    assert.equal(designationSchema.parse(base).rank, undefined)
  })

  it('still accepts an explicit rank', () => {
    assert.equal(designationSchema.parse({ ...base, rank: 3 }).rank, 3)
    assert.equal(designationSchema.parse({ ...base, rank: '3' }).rank, 3)
  })

  it('rejects ranks below 1, which would outrank the top of the category', () => {
    assert.equal(designationSchema.safeParse({ ...base, rank: 0 }).success, false)
  })

  it('rejects non-integer ranks', () => {
    assert.equal(designationSchema.safeParse({ ...base, rank: 1.5 }).success, false)
  })

  it('rejects a non-numeric rank instead of coercing it to NaN', () => {
    assert.equal(designationSchema.safeParse({ ...base, rank: 'high' }).success, false)
  })
})
