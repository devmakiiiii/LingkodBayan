import * as levenshteinNamespace from 'fast-levenshtein'
import * as nysiisNamespace from 'nysiis'

// `fast-levenshtein` and `nysiis` are CommonJS packages. The Next.js bundler
// and the Node test runner surface their exports differently (bundlers expose
// named exports / `exports.default`, while Node's ESM interop exposes the raw
// `module.exports`), so resolve both shapes here to keep the matching logic
// usable from `node --test` as well as from the app.
type LevenshteinFn = (a: string, b: string) => number
type NysiisEncoder = { encode(name: string): string }

const levenshteinModule = levenshteinNamespace as unknown as {
  get?: LevenshteinFn
  default?: LevenshteinFn | { get?: LevenshteinFn }
}
const levenshteinGet: LevenshteinFn =
  typeof levenshteinModule.get === 'function'
    ? levenshteinModule.get
    : (levenshteinModule.default as { get: LevenshteinFn }).get

const nysiisExport: unknown = nysiisNamespace.default
type NysiisConstructor = new () => NysiisEncoder
const Nysiis: NysiisConstructor =
  typeof nysiisExport === 'function'
    ? (nysiisExport as NysiisConstructor)
    : (nysiisExport as { default: NysiisConstructor }).default

const nysiisEncoder = new Nysiis()

export type VerificationStatus =
  | 'unverified'
  | 'auto_verified'
  | 'id_verified'
  | 'needs_review'
  | 'rejected'

export type VerificationMethod =
  | 'form_match'
  | 'id_ocr'
  | 'manual'
  | 'admin_override'

export interface VerificationThresholds {
  autoVerifyThreshold: number
  idVerifyThreshold: number
  manualReviewThreshold: number
  nameWeight: number
  emailWeight: number
  phoneWeight: number
  addressWeight: number
  dobWeight: number
  nationalIdWeight: number
}

export const DEFAULT_THRESHOLDS: VerificationThresholds = {
  autoVerifyThreshold: 85,
  idVerifyThreshold: 75,
  manualReviewThreshold: 50,
  nameWeight: 0.40,
  emailWeight: 0.25,
  phoneWeight: 0.15,
  addressWeight: 0.10,
  dobWeight: 0.03,
  nationalIdWeight: 0.07,
}

export interface SignUpVerificationInput {
  firstName: string
  lastName: string
  middleName?: string
  email: string
  phone?: string
  address?: string
  barangay?: string
  dateOfBirth?: string
  nationalId?: string
}

export interface PreRegisteredResident {
  id: string
  first_name: string
  last_name: string
  middle_name?: string | null
  date_of_birth?: string | null
  email: string
  phone?: string | null
  street_address?: string | null
  barangay: string
  national_id?: string | null
}

export interface MatchResult {
  matched: boolean
  confidence: number
  matchedResident: {
    id: string
    firstName: string
    lastName: string
    email: string
    barangay: string
  } | null
  action: 'auto_verify' | 'id_verify' | 'needs_review' | 'no_match'
  confidenceBreakdown: Record<string, number>
}

export function normalizeString(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/^[\s.]+|[\s.]+$/g, '')
}

const ABBREVIATION_MAP: Record<string, string> = {
  st: 'saint',
  'st.': 'saint',
  ave: 'avenue',
  av: 'avenue',
  blvd: 'boulevard',
  rd: 'road',
  nsc: 'national',
  philsys: 'philsys',
}

export function normalizeAddress(str: string | null | undefined): string {
  if (!str) return ''
  const normalized = normalizeString(str)
  const tokens = normalized.split(/\s+/)
  const expanded = tokens.map((t) => ABBREVIATION_MAP[t] || t)
  return expanded.join(' ')
}

export function levenshteinSimilarity(a: string, b: string): number {
  const na = normalizeString(a)
  const nb = normalizeString(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  const distance = levenshteinGet(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return Math.max(0, 1 - distance / maxLen)
}

export function phoneticSimilarity(a: string, b: string): number {
  const pa = nysiisEncoder.encode(normalizeString(a))
  const pb = nysiisEncoder.encode(normalizeString(b))
  if (pa === pb) return 1
  return 0
}

export function nameMatchScore(
  firstNameA: string,
  lastNameA: string,
  firstNameB: string,
  lastNameB: string,
): number {
  const firstLev = levenshteinSimilarity(firstNameA, firstNameB)
  const lastLev = levenshteinSimilarity(lastNameA, lastNameB)
  const firstPhonetic = phoneticSimilarity(firstNameA, firstNameB)
  const lastPhonetic = phoneticSimilarity(lastNameA, lastNameB)

  // Take the best score per name part (levenshtein or phonetic)
  const firstScore = Math.max(firstLev, firstPhonetic)
  const lastScore = Math.max(lastLev, lastPhonetic)

  // Weight last name more (0.6) than first name (0.4)
  return firstScore * 0.4 + lastScore * 0.6
}

export function emailMatch(emailA: string, emailB: string): number {
  const na = normalizeString(emailA)
  const nb = normalizeString(emailB)
  if (na === nb) return 1
  return levenshteinSimilarity(na, nb)
}

export function phoneMatch(phoneA: string, phoneB: string): number {
  const normalizePhone = (p: string): string =>
    p.replace(/\D/g, '').replace(/^63/, '0').replace(/^00/, '0')
  const pa = normalizePhone(phoneA)
  const pb = normalizePhone(phoneB)
  if (pa === pb) return 1
  if (!pa || !pb) return 0
  return 0
}

export function addressMatch(addrA: string, addrB: string): number {
  const na = normalizeAddress(addrA)
  const nb = normalizeAddress(addrB)
  if (!na || !nb) return 0
  if (na === nb) return 1
  return levenshteinSimilarity(na, nb)
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

function monthFromName(token: string): number | null {
  const cleaned = normalizeString(token)
  if (cleaned.length < 3) return null
  const prefix = cleaned.slice(0, 3)
  const index = MONTH_NAMES.findIndex((month) => month.startsWith(prefix))
  return index === -1 ? null : index + 1
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Normalizes the date formats that show up on Philippine IDs and in the
 * pre-registered registry (a SQL `DATE` column) into ISO `YYYY-MM-DD`.
 *
 * PhilSys, UMID and driver's licenses print dates as `MM/DD/YYYY`, so numeric
 * dates are read month-first. Unrecognized values return `null` so callers can
 * fall back to a digits-only comparison.
 */
export function normalizeDateOfBirth(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  // ISO (including `1990-05-12T00:00:00.000Z` from a DATE column)
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  // MM/DD/YYYY and MM/DD/YY
  const numericMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (numericMatch) {
    let year = Number(numericMatch[3])
    if (year < 100) year += year > 30 ? 1900 : 2000
    return toIsoDate(year, Number(numericMatch[1]), Number(numericMatch[2]))
  }

  // "MAY 12, 1990" / "MAY 12 1990"
  const monthFirstMatch = raw.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthFirstMatch) {
    const month = monthFromName(monthFirstMatch[1])
    if (month) return toIsoDate(Number(monthFirstMatch[3]), month, Number(monthFirstMatch[2]))
  }

  // "12 MAY 1990" / "12 MAY, 1990"
  const dayFirstMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/)
  if (dayFirstMatch) {
    const month = monthFromName(dayFirstMatch[2])
    if (month) return toIsoDate(Number(dayFirstMatch[3]), month, Number(dayFirstMatch[1]))
  }

  return null
}

export function dobMatch(dobA: string, dobB: string): number {
  // Compare canonical dates first: the registry stores `YYYY-MM-DD` while OCR
  // reads `MM/DD/YYYY` off most Philippine IDs, so a raw string comparison made
  // this signal fail for every real ID.
  const isoA = normalizeDateOfBirth(dobA)
  const isoB = normalizeDateOfBirth(dobB)
  if (isoA && isoB) return isoA === isoB ? 1 : 0

  // Fall back to a digits-only comparison for formats we do not recognize.
  const na = dobA.replace(/\D/g, '')
  const nb = dobB.replace(/\D/g, '')
  if (!na || !nb) return 0
  return na === nb ? 1 : 0
}

export function nationalIdMatch(idA: string, idB: string): number {
  const normalizeId = (id: string): string => id.replace(/\D/g, '')
  const na = normalizeId(idA)
  const nb = normalizeId(idB)
  if (na === nb && na.length > 0) return 1
  return 0
}

export function calculateMatchScore(
  input: SignUpVerificationInput,
  candidate: PreRegisteredResident,
  thresholds: VerificationThresholds = DEFAULT_THRESHOLDS,
): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}

  const nameScore = nameMatchScore(
    input.firstName,
    input.lastName,
    candidate.first_name,
    candidate.last_name,
  )
  breakdown.name = nameScore

  const emailScore = input.email
    ? emailMatch(input.email, candidate.email)
    : 0
  breakdown.email = emailScore

  const phoneScore =
    input.phone && candidate.phone
      ? phoneMatch(input.phone, candidate.phone)
      : 0
  breakdown.phone = phoneScore

  const addressParts = [input.address, input.barangay].filter(Boolean).join(', ')
  const candidateAddress = [candidate.street_address, candidate.barangay].filter(Boolean).join(', ')
  const addressScore = addressParts && candidateAddress ? addressMatch(addressParts, candidateAddress) : 0
  breakdown.address = addressScore

  const dobScore =
    input.dateOfBirth && candidate.date_of_birth
      ? dobMatch(input.dateOfBirth, candidate.date_of_birth)
      : 0
  breakdown.dob = dobScore

  const nidScore =
    input.nationalId && candidate.national_id
      ? nationalIdMatch(input.nationalId, candidate.national_id)
      : 0
  breakdown.nationalId = nidScore

  // Check for exact-match strong signals (email, phone, national ID)
  // These override the weighted score for high confidence

  const totalWeight =
    thresholds.nameWeight +
    thresholds.emailWeight +
    thresholds.phoneWeight +
    thresholds.addressWeight +
    thresholds.dobWeight +
    thresholds.nationalIdWeight

  // Adjust weights: if email is an exact match, override to 100
  if (emailScore === 1) {
    return { score: 100, breakdown }
  }
  if (phoneScore === 1 && nameScore >= 0.8) {
    return { score: 98, breakdown }
  }
  if (nidScore === 1 && nameScore >= 0.7) {
    return { score: 99, breakdown }
  }

  // Weighted average
  let weightedSum =
    nameScore * thresholds.nameWeight +
    emailScore * thresholds.emailWeight +
    phoneScore * thresholds.phoneWeight +
    addressScore * thresholds.addressWeight +
    dobScore * thresholds.dobWeight +
    nidScore * thresholds.nationalIdWeight
  weightedSum = weightedSum / totalWeight * 100

  // Boost if name match is very high (≥0.9)
  if (nameScore >= 0.9 && emailScore >= 0.5) {
    weightedSum = Math.min(100, weightedSum + 5)
  }

  return { score: Math.round(weightedSum * 100) / 100, breakdown }
}

export function determineAction(
  score: number,
  thresholds: VerificationThresholds = DEFAULT_THRESHOLDS,
): MatchResult['action'] {
  if (score >= thresholds.autoVerifyThreshold) return 'auto_verify'
  if (score >= thresholds.idVerifyThreshold) return 'id_verify'
  if (score >= thresholds.manualReviewThreshold) return 'needs_review'
  return 'no_match'
}

/**
 * Fields read off an ID document by OCR. Everything is optional because a real
 * photo rarely yields every field.
 */
export interface OcrIdentityFields {
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  dateOfBirth?: string | null
  nationalId?: string | null
}

export interface DocumentConsistencyResult {
  score: number
  breakdown: Record<string, number>
  /** Field keys that produced a real comparison (both sides had a value). */
  comparedFields: string[]
  /** Share of the total signal weight actually compared (0 - 1). */
  evidenceStrength: number
}

/**
 * Relative importance of each identity signal when a registry
 * (`pre_registered_residents`) record is unavailable and we can only check the
 * document against what the user typed into their own account.
 */
const DOCUMENT_SIGNAL_WEIGHTS = {
  nationalId: 0.35,
  dateOfBirth: 0.25,
  name: 0.25,
  address: 0.15,
} as const

/**
 * Weighted average of the identity fields taken from the ID that are also
 * present on the account.
 *
 * This is deliberately NOT an authorization signal: the same person supplies
 * both sides of the comparison, so a high score only proves the document is
 * legible and self-consistent. Thresholds are not applied to it and it must
 * never drive `auto_verify`; it exists so the UI can report something truthful
 * instead of a hard-coded 0%.
 */
export function calculateDocumentConsistencyScore(
  extracted: OcrIdentityFields,
  account: SignUpVerificationInput,
): DocumentConsistencyResult {
  const breakdown: Record<string, number> = {}
  const comparedFields: string[] = []
  let weightedSum = 0
  let appliedWeight = 0

  const include = (field: keyof typeof DOCUMENT_SIGNAL_WEIGHTS, score: number) => {
    const weight = DOCUMENT_SIGNAL_WEIGHTS[field]
    breakdown[field] = score
    comparedFields.push(field)
    weightedSum += score * weight
    appliedWeight += weight
  }

  const nationalId = (extracted.nationalId || '').trim()
  if (nationalId && account.nationalId) {
    include('nationalId', nationalIdMatch(nationalId, account.nationalId))
  }

  const dateOfBirth = (extracted.dateOfBirth || '').trim()
  if (dateOfBirth && account.dateOfBirth) {
    include('dateOfBirth', dobMatch(dateOfBirth, account.dateOfBirth))
  }

  const extractedFirstName = (extracted.firstName || '').trim()
  const extractedLastName = (extracted.lastName || '').trim()
  if ((extractedFirstName || extractedLastName) && (account.firstName || account.lastName)) {
    include(
      'name',
      nameMatchScore(extractedFirstName, extractedLastName, account.firstName, account.lastName),
    )
  }

  const address = (extracted.address || '').trim()
  if (address && account.address) {
    include('address', addressMatch(address, account.address))
  }

  if (appliedWeight === 0) {
    return { score: 0, breakdown, comparedFields, evidenceStrength: 0 }
  }

  return {
    score: Math.round((weightedSum / appliedWeight) * 100 * 100) / 100,
    breakdown,
    comparedFields,
    evidenceStrength: Math.round(appliedWeight * 100) / 100,
  }
}

/**
 * Prefers values read off the ID over the values the user typed, so registry
 * comparisons are driven by the document whenever it was legible.
 */
export function mergeExtractedFields(
  expected: SignUpVerificationInput,
  extracted: OcrIdentityFields,
): SignUpVerificationInput {
  const pick = (primary: string | null | undefined, fallback?: string) => {
    const value = (primary || '').trim()
    return value || fallback || ''
  }

  return {
    firstName: pick(extracted.firstName, expected.firstName),
    lastName: pick(extracted.lastName, expected.lastName),
    middleName: pick(extracted.middleName, expected.middleName),
    email: pick(extracted.email, expected.email),
    phone: pick(extracted.phone, expected.phone),
    address: pick(extracted.address, expected.address),
    barangay: expected.barangay,
    dateOfBirth: pick(extracted.dateOfBirth, expected.dateOfBirth),
    nationalId: pick(extracted.nationalId, expected.nationalId),
  }
}

export function parseOcrExtractedFields(
  ocrText: string,
  idType: string,
): Record<string, string> {
  const text = ocrText.toUpperCase()
  const result: Record<string, string> = {}

  const idTypeParsers: Record<string, (text: string) => Record<string, string>> = {
    philsys: (t) => parsePhilsysFields(t),
    drivers_license: (t) => parseDriversLicenseFields(t),
    passport: (t) => parsePassportFields(t),
    voter: (t) => parseVoterFields(t),
  }

  const parser = idTypeParsers[idType] || idTypeParsers.philsys
  return parser(text)
}

function parsePhilsysFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const fullNameMatch = text.match(/FULL NAME\s*[:\-]?\s*([A-Z][A-Z.,'\- ]+)/i)
  if (fullNameMatch) {
    const parts = fullNameMatch[1].trim()
    fields.fullName = parts
    const nameParts = parts.split(/\s+/)
    if (nameParts.length >= 2) {
      fields.firstName = nameParts[0]
      fields.lastName = nameParts[nameParts.length - 1]
      if (nameParts.length > 2) {
        fields.middleName = nameParts.slice(1, -1).join(' ')
      }
    }
  }

  const idMatch = text.match(/PHILSYS\s*(?:ID)?\s*NO\.?\s*[:\-]?\s*(\d{12})/i) || text.match(/PSN\s*[:\-]?\s*(\d{12})/i)
  if (idMatch) fields.nationalId = idMatch[1]

  const dobMatchResult = text.match(/(?:DATE\s*OF\s*BIRTH|DOB|BIRTHDATE)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
  if (dobMatchResult) fields.dateOfBirth = dobMatchResult[1]

  const addressMatch = text.match(/ADDRESS\s*[:\-]?\s*([A-Z0-9][A-Z0-9.,'\- ]+)/i)
  if (addressMatch) fields.address = addressMatch[1].trim()

  return fields
}

function parseDriversLicenseFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const lastMatch = text.match(/LAST NAME\s*[:\-]?\s*([A-Z ]+)/i)
  if (lastMatch) fields.lastName = lastMatch[1].trim()
  const firstMatch = text.match(/FIRST NAME\s*[:\-]?\s*([A-Z ]+)/i)
  if (firstMatch) fields.firstName = firstMatch[1].trim()
  const middleMatch = text.match(/MIDDLE NAME\s*[:\-]?\s*([A-Z ]*)/i)
  if (middleMatch) fields.middleName = middleMatch[1].trim()
  const dobMatchResult = text.match(/BIRTHDATE\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
  if (dobMatchResult) fields.dateOfBirth = dobMatchResult[1]
  const addressMatch = text.match(/ADDRESS\s*[:\-]?\s*([A-Z0-9][A-Z0-9.,'\- ]+)/i)
  if (addressMatch) fields.address = addressMatch[1].trim()
  return fields
}

function parsePassportFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const surnameMatch = text.match(/SURNAME\s*[:\-]?\s*([A-Z ]+)/i)
  if (surnameMatch) fields.lastName = surnameMatch[1].trim()
  const givenMatch = text.match(/GIVEN NAMES?\s*[:\-]?\s*([A-Z ]+)/i)
  if (givenMatch) fields.firstName = givenMatch[1].trim()
  const dobMatchResult = text.match(/DATE\s*OF\s*BIRTH\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
  if (dobMatchResult) fields.dateOfBirth = dobMatchResult[1]
  return fields
}

function parseVoterFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const nameMatch = text.match(/(?:NAME|VOTER'S NAME)\s*[:\-]?\s*([A-Z][A-Z.,'\- ]+)/i)
  if (nameMatch) {
    fields.fullName = nameMatch[1].trim()
    const parts = nameMatch[1].trim().split(/\s+/)
    if (parts.length >= 2) {
      fields.firstName = parts[0]
      fields.lastName = parts[parts.length - 1]
    }
  }
  const dobMatchResult = text.match(/(?:BIRTHDAY|BIRTH DATE|DOB)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
  if (dobMatchResult) fields.dateOfBirth = dobMatchResult[1]
  const addressMatch = text.match(/ADDRESS\s*[:\-]?\s*([A-Z0-9][A-Z0-9.,'\- ]+)/i)
  if (addressMatch) fields.address = addressMatch[1].trim()
  return fields
}
