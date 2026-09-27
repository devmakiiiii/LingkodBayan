/**
 * Unit tests for the identity verification matching logic.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/verification.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_THRESHOLDS,
  addressMatch,
  calculateDocumentConsistencyScore,
  calculateMatchScore,
  determineAction,
  dobMatch,
  emailMatch,
  levenshteinSimilarity,
  mergeExtractedFields,
  nameMatchScore,
  nationalIdMatch,
  normalizeAddress,
  normalizeDateOfBirth,
  normalizeString,
  parseOcrExtractedFields,
  phoneMatch,
  type PreRegisteredResident,
  type SignUpVerificationInput,
} from './verification.ts'

const candidate: PreRegisteredResident = {
  id: 'prereg-1',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  middle_name: 'Santos',
  date_of_birth: '1990-05-12',
  email: 'juan.cruz@example.com',
  phone: '09171234567',
  street_address: '123 P. Burgos St',
  barangay: 'Barangay 1',
  national_id: '123456789012',
}

function buildInput(overrides: Partial<SignUpVerificationInput> = {}): SignUpVerificationInput {
  return {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan.cruz@example.com',
    ...overrides,
  }
}

describe('string normalization', () => {
  it('lowercases, trims, strips punctuation, and collapses whitespace', () => {
    assert.equal(normalizeString('  Dela Cruz!!  '), 'dela cruz')
    assert.equal(normalizeString("JUAN\t  SANTOS."), 'juan santos')
    assert.equal(normalizeString(null), '')
    assert.equal(normalizeString(undefined), '')
  })

  it('expands common address abbreviations', () => {
    assert.equal(normalizeAddress('123 St. Andrew Ave'), '123 saint andrew avenue')
    assert.equal(normalizeAddress('Rizal Blvd.'), 'rizal boulevard')
  })
})

describe('field similarity helpers', () => {
  it('scores identical strings (case-insensitive) as 1', () => {
    assert.equal(levenshteinSimilarity('Juan', 'JUAN'), 1)
    assert.equal(emailMatch('Juan@Example.com', 'juan@example.com'), 1)
  })

  it('scores empty-vs-nonempty as 0 and both-empty as 1', () => {
    assert.equal(levenshteinSimilarity('Juan', ''), 0)
    assert.equal(levenshteinSimilarity('', ''), 1)
  })

  it('normalizes Philippine phone formats before comparing', () => {
    assert.equal(phoneMatch('09171234567', '+63 917 123 4567'), 1)
    assert.equal(phoneMatch('09171234567', '09179999999'), 0)
  })

  it('compares national IDs ignoring formatting', () => {
    assert.equal(nationalIdMatch('1234-5678-9012', '123456789012'), 1)
    assert.equal(nationalIdMatch('1234-5678-9012', '999999999999'), 0)
    assert.equal(nationalIdMatch('', ''), 0)
  })

  it('compares dates ignoring separators', () => {
    assert.equal(dobMatch('1990-05-12', '1990-05-12'), 1)
    assert.equal(dobMatch('1990-05-12', '1991-05-12'), 0)
  })

  it('scores exact address matches as 1 and different addresses well below a match', () => {
    assert.equal(addressMatch('123 P. Burgos St, Barangay 1', '123 P Burgos St, Barangay 1'), 1)
    assert.ok(
      addressMatch('Different Place', 'Barangay 1') < 0.5,
      'different addresses should score well below a match',
    )
  })
})

describe('nameMatchScore', () => {
  it('scores exact first and last names as 1', () => {
    assert.equal(nameMatchScore('Juan', 'Dela Cruz', 'Juan', 'Dela Cruz'), 1)
    assert.equal(nameMatchScore('JUAN', 'DELA CRUZ', 'juan', 'dela cruz'), 1)
  })

  it('scores mismatched last names below perfect (regression: self-comparison typo)', () => {
    const score = nameMatchScore('Juan', 'Cruz', 'Juan', 'Bagong')
    assert.ok(score < 1, `expected score < 1, got ${score}`)
    assert.ok(score >= 0.4, `expected first-name credit, got ${score}`)
  })

  it('scores completely different names far below the auto-verify bar', () => {
    const score = nameMatchScore('Pedro', 'Bagong', 'Juan', 'Dela Cruz')
    assert.ok(score < 0.5, `expected score < 0.5, got ${score}`)
  })
})


describe('calculateMatchScore', () => {
  it('auto-verifies on an exact email match (score 100)', () => {
    const { score } = calculateMatchScore(buildInput(), candidate)
    assert.equal(score, 100)
  })

  it('scores an exact phone + name match at 98', () => {
    const { score } = calculateMatchScore(
      buildInput({ email: 'other@example.com', phone: '+63 917 123 4567' }),
      candidate,
    )
    assert.equal(score, 98)
  })

  it('scores an exact national ID + name match at 99', () => {
    const { score } = calculateMatchScore(
      buildInput({ email: 'other@example.com', nationalId: '1234-5678-9012' }),
      candidate,
    )
    assert.equal(score, 99)
  })

  it('falls below the manual review threshold when nothing matches', () => {
    const { score, breakdown } = calculateMatchScore(
      buildInput({
        firstName: 'Pedro',
        lastName: 'Bagong',
        email: 'pedro.bagong@newmail.com',
        phone: '09990001112',
        nationalId: '999999999999',
      }),
      candidate,
    )
    assert.ok(
      score < DEFAULT_THRESHOLDS.manualReviewThreshold,
      `expected < ${DEFAULT_THRESHOLDS.manualReviewThreshold}, got ${score}`,
    )
    assert.equal(determineAction(score), 'no_match')
    assert.ok('name' in breakdown && 'email' in breakdown)
  })

  it('exposes a per-field confidence breakdown', () => {
    const { breakdown } = calculateMatchScore(
      buildInput({ email: 'other@example.com' }),
      candidate,
    )
    for (const key of ['name', 'email', 'phone', 'address', 'dob', 'nationalId']) {
      assert.ok(key in breakdown, `missing breakdown key: ${key}`)
      assert.ok(breakdown[key] >= 0 && breakdown[key] <= 1)
    }
  })
})

describe('determineAction thresholds', () => {
  it('maps scores to the hybrid flow actions', () => {
    assert.equal(determineAction(100), 'auto_verify')
    assert.equal(determineAction(DEFAULT_THRESHOLDS.autoVerifyThreshold), 'auto_verify')
    assert.equal(determineAction(DEFAULT_THRESHOLDS.autoVerifyThreshold - 1), 'id_verify')
    assert.equal(determineAction(DEFAULT_THRESHOLDS.idVerifyThreshold), 'id_verify')
    assert.equal(determineAction(DEFAULT_THRESHOLDS.idVerifyThreshold - 1), 'needs_review')
    assert.equal(determineAction(DEFAULT_THRESHOLDS.manualReviewThreshold), 'needs_review')
    assert.equal(determineAction(DEFAULT_THRESHOLDS.manualReviewThreshold - 1), 'no_match')
    assert.equal(determineAction(0), 'no_match')
  })
})

describe('parseOcrExtractedFields (PhilSys)', () => {
  it('extracts name, national ID, DOB, and address from OCR text', () => {
    const ocrText = [
      'REPUBLIC OF THE PHILIPINES',
      'FULL NAME: JUAN DELA CRUZ',
      'PHILSYS ID NO: 123456789012',
      'DATE OF BIRTH: 05/12/1990',
      'ADDRESS: 123 P BURGOS ST BARANGAY 1',
    ].join('\n')

    const fields = parseOcrExtractedFields(ocrText, 'philsys')
    assert.equal(fields.firstName, 'JUAN')
    assert.equal(fields.lastName, 'CRUZ')
    assert.equal(fields.middleName, 'DELA')
    assert.equal(fields.nationalId, '123456789012')
    assert.equal(fields.dateOfBirth, '05/12/1990')
  })

  it('returns an empty object when no known patterns are present', () => {
    const fields = parseOcrExtractedFields('garbage text with no structure', 'philsys')
    assert.deepEqual(fields, {})
  })
})

describe('date-of-birth normalization', () => {
  it('matches ISO registry dates against the MM/DD/YYYY printed on IDs', () => {
    assert.equal(dobMatch('05/12/1990', '1990-05-12'), 1)
    assert.equal(dobMatch('1990-05-12T00:00:00.000Z', '05/12/1990'), 1)
    assert.equal(dobMatch('MAY 12, 1990', '1990-05-12'), 1)
  })

  it('keeps genuinely different dates apart', () => {
    assert.equal(dobMatch('05/12/1990', '1990-12-05'), 0)
    assert.equal(dobMatch('JUNE 12, 1990', '1990-05-12'), 0)
  })

  it('normalizes the formats found on Philippine IDs to ISO', () => {
    assert.equal(normalizeDateOfBirth('05/12/1990'), '1990-05-12')
    assert.equal(normalizeDateOfBirth('12 MAY 1990'), '1990-05-12')
    assert.equal(normalizeDateOfBirth('1990-05-12'), '1990-05-12')
    assert.equal(normalizeDateOfBirth('not a date'), null)
    assert.equal(normalizeDateOfBirth(''), null)
  })
})

describe('calculateDocumentConsistencyScore', () => {
  const account = buildInput({
    dateOfBirth: '1990-05-12',
    nationalId: '123456789012',
    address: '123 P. Burgos St, Barangay 1',
  })

  it('scores a fully consistent ID at 100', () => {
    const result = calculateDocumentConsistencyScore(
      {
        firstName: 'JUAN',
        lastName: 'DELA CRUZ',
        dateOfBirth: '05/12/1990',
        nationalId: '1234-5678-9012',
        address: '123 P BURGOS ST BARANGAY 1',
      },
      account,
    )
    assert.equal(result.score, 100)
    assert.deepEqual(result.comparedFields.sort(), ['address', 'dateOfBirth', 'name', 'nationalId'])
    assert.equal(result.evidenceStrength, 1)
  })

  it('ignores fields OCR did not return instead of scoring them as zero', () => {
    const result = calculateDocumentConsistencyScore(
      { firstName: 'Juan', lastName: 'Dela Cruz' },
      account,
    )
    assert.equal(result.score, 100)
    assert.deepEqual(result.comparedFields, ['name'])
    assert.equal(result.evidenceStrength, 0.25)
  })

  it('flags a document whose details disagree with the account', () => {
    const result = calculateDocumentConsistencyScore(
      {
        firstName: 'Pedro',
        lastName: 'Bagong',
        dateOfBirth: '01/01/1975',
        nationalId: '999999999999',
        address: 'Somewhere Else',
      },
      account,
    )
    assert.ok(result.score < 40, `expected < 40, got ${result.score}`)
    assert.equal(result.evidenceStrength, 1)
  })

  it('reports zero evidence when nothing comparable could be read', () => {
    const result = calculateDocumentConsistencyScore({}, account)
    assert.equal(result.score, 0)
    assert.equal(result.evidenceStrength, 0)
    assert.deepEqual(result.comparedFields, [])
  })
})

describe('mergeExtractedFields', () => {
  it('prefers what the ID says and falls back to typed values', () => {
    const merged = mergeExtractedFields(
      buildInput({ address: 'typed address', dateOfBirth: '1990-05-12' }),
      { firstName: 'JUAN', lastName: '' },
    )
    assert.equal(merged.firstName, 'JUAN')
    assert.equal(merged.lastName, 'Dela Cruz')
    assert.equal(merged.address, 'typed address')
    assert.equal(merged.dateOfBirth, '1990-05-12')
  })
})
