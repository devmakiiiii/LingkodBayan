/**
 * Unit tests for the single-barangay deployment constants.
 *
 * LingkodBayan serves exactly one barangay, so the barangay is a fixed system
 * constant rather than something a resident picks. These tests lock the
 * acceptance set that `canonicalBarangayName` shares with the CHECK constraints
 * in `scripts/34_single_barangay_barretto.sql`.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/schemas.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BARANGAY_CITY,
  BARANGAY_DISPLAY_NAME,
  BARANGAY_FULL_LABEL,
  BARANGAY_NAME,
  BARANGAY_PROVINCE,
  canonicalBarangayName,
  isInServiceArea,
  loginSchema,
  MIN_PASSWORD_LENGTH,
  resetPasswordSchema,
  signUpBarangaySchema,
  signUpSchema,
} from './schemas.ts'

describe('barangay constants', () => {
  it('describes Barangay Barretto in Olongapo City, Zambales', () => {
    assert.equal(BARANGAY_NAME, 'Barretto')
    assert.equal(BARANGAY_DISPLAY_NAME, 'Barangay Barretto')
    assert.equal(BARANGAY_CITY, 'Olongapo City')
    assert.equal(BARANGAY_PROVINCE, 'Zambales')
    assert.equal(BARANGAY_FULL_LABEL, 'Barangay Barretto, Olongapo City')
  })
})

describe('canonicalBarangayName', () => {
  it('accepts every spelling of Barretto', () => {
    const spellings = [
      'Barretto',
      'barretto',
      'BARRETTO',
      'Barangay Barretto',
      'barangay barretto',
      'Brgy. Barretto',
      'brgy barretto',
    ]

    for (const spelling of spellings) {
      assert.equal(canonicalBarangayName(spelling), BARANGAY_NAME, `expected "${spelling}" to canonicalize`)
    }
  })

  it('defaults blank input to the system barangay', () => {
    assert.equal(canonicalBarangayName(''), BARANGAY_NAME)
    assert.equal(canonicalBarangayName('   '), BARANGAY_NAME)
    assert.equal(canonicalBarangayName(null), BARANGAY_NAME)
    assert.equal(canonicalBarangayName(undefined), BARANGAY_NAME)
  })

  it('rejects barangays outside the service area', () => {
    const outside = [
      'New Cabalan',
      'East Bajac-bajac',
      'Gordon Heights',
      'Barangay 1',
      'Olongapo City',
      'Subic',
    ]

    for (const value of outside) {
      assert.equal(canonicalBarangayName(value), null, `expected "${value}" to be rejected`)
    }
  })
})

describe('isInServiceArea', () => {
  it('accepts every Barretto spelling and blank values', () => {
    for (const value of ['Barretto', 'Barangay Barretto', 'Brgy. Barretto', '', '   ', null, undefined]) {
      assert.equal(isInServiceArea(value), true, `expected ${JSON.stringify(value)} to be in area`)
    }
  })

  it('rejects registry values that belong to another barangay or city', () => {
    // These are the values left in `pre_registered_residents` by earlier
    // imports; they must never be treated as in-area candidates.
    const outOfArea = ['San Antonio', 'Balintawak', 'Kawit', 'Tandang Sora', 'Sta. Rita', 'Santa Rita', 'New Cabalan']

    for (const value of outOfArea) {
      assert.equal(isInServiceArea(value), false, `expected "${value}" to be out of area`)
    }
  })
})

describe('signUpBarangaySchema', () => {
  it('accepts Barangay Barretto', () => {
    assert.equal(signUpBarangaySchema.safeParse(BARANGAY_NAME).success, true)
  })

  it('rejects any other barangay with a message naming the service area', () => {
    const result = signUpBarangaySchema.safeParse('New Cabalan')

    assert.equal(result.success, false)
    if (!result.success) {
      assert.match(result.error.issues[0]?.message ?? '', /only serves Barangay Barretto/)
    }
  })

  it('keeps full sign-up validation pinned to the single barangay', () => {
    const base = {
      email: 'juan@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
    }

    assert.equal(signUpSchema.safeParse({ ...base, barangay: BARANGAY_NAME }).success, true)
    assert.equal(signUpSchema.safeParse({ ...base, barangay: 'Gordon Heights' }).success, false)
  })
})

describe('password policy', () => {
  it('requires the shared minimum length for sign-in and account creation', () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8)

    const tooShort = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    const justEnough = 'a'.repeat(MIN_PASSWORD_LENGTH)

    assert.equal(loginSchema.safeParse({ email: 'juan@example.com', password: tooShort }).success, false)
    assert.equal(loginSchema.safeParse({ email: 'juan@example.com', password: justEnough }).success, true)
  })

  it('applies the same minimum to sign-up and password reset', () => {
    const tooShort = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)

    const signUp = signUpSchema.safeParse({
      email: 'juan@example.com',
      password: tooShort,
      confirmPassword: tooShort,
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      barangay: BARANGAY_NAME,
    })

    assert.equal(signUp.success, false)
    if (!signUp.success) {
      assert.match(signUp.error.issues[0]?.message ?? '', new RegExp(`at least ${MIN_PASSWORD_LENGTH}`))
    }

    assert.equal(
      resetPasswordSchema.safeParse({ password: tooShort, confirmPassword: tooShort }).success,
      false,
    )
  })

  it('still rejects mismatched confirmations', () => {
    const valid = 'a'.repeat(MIN_PASSWORD_LENGTH)
    const mismatch = resetPasswordSchema.safeParse({ password: valid, confirmPassword: `${valid}x` })

    assert.equal(mismatch.success, false)
    if (!mismatch.success) {
      assert.match(mismatch.error.issues[0]?.message ?? '', /don't match/)
    }
  })
})
