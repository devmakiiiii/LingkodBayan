import type { SupabaseClient, User } from '@supabase/supabase-js'
import { logger } from './logger'
import { BARANGAY_NAME, canonicalBarangayName } from './barangay.ts'

type ResidentProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  address?: string | null
  barangay: string
  date_of_birth?: string | null
  national_id?: string | null
  id_type?: string | null
  verification_status?: string | null
  verification_confidence?: number | null
}

const RESIDENT_PROFILE_COLUMNS =
  'id, user_id, first_name, last_name, email, phone, address, barangay, date_of_birth, national_id, id_type, verification_status, verification_confidence'

function getUserField(user: User, key: string) {
  return typeof user.user_metadata?.[key] === 'string'
    ? String(user.user_metadata[key]).trim()
    : ''
}

function getUserPhone(user: User) {
  const phone = user.user_metadata?.phone
  if (typeof phone === 'string') {
    return phone.trim() || null
  }
  return null
}

function getUserAddress(user: User) {
  const address = user.user_metadata?.address
  if (typeof address === 'string') {
    return address.trim() || null
  }
  return null
}

async function applyAutoVerification(
  supabase: SupabaseClient,
  residentId: string,
) {
  const { error: updateError } = await supabase
    .from('residents')
    .update({
      verification_status: 'auto_verified',
      verification_method: 'form_match',
      verification_confidence: 100,
      verification_details: { source: 'sign_up_auto_match' },
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', residentId)

  if (updateError) {
    logger.error('applyAutoVerification - update error', updateError, { context: 'lib/residents' })
    return
  }

  const { error: logError } = await supabase
    .from('verification_attempts')
    .insert([
      {
        resident_id: residentId,
        attempt_type: 'form_match',
        input_data: null,
        matched_pre_registered_id: null,
        match_score: 100,
        confidence_breakdown: { source: 'sign_up_auto_match' },
        ocr_extracted_data: null,
        status: 'matched',
      },
    ])

  if (logError) {
    logger.error('applyAutoVerification - log error', logError, { context: 'lib/residents' })
  }
}

/**
 * Finds an existing resident row that owns the given phone number, comparing on
 * digits-only normalization to tolerate formatting differences (spaces, dashes,
 * +63 vs 09 prefixes). This mirrors the `uq_residents_phone_normalized` unique
 * index so we can identify the conflicting row after a 23505 insert failure.
 */
async function findResidentByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<ResidentProfile | null> {
  // 1. Exact string match — covers the common case where the same formatting is reused.
  const { data: exact } = await supabase
    .from('residents')
    .select(RESIDENT_PROFILE_COLUMNS)
    .eq('phone', phone)
    .limit(1)
  if (exact?.[0]) return exact[0] as ResidentProfile

  // 2. Digits-normalized fallback — catches formatted variants (e.g. stored
  //    "0917-123-4567" vs input "09171234567"). Bound the fetch so this stays
  //    cheap even as the residents table grows.
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  const { data: candidates } = await supabase
    .from('residents')
    .select(RESIDENT_PROFILE_COLUMNS)
    .not('phone', 'is', null)
    .limit(50)

  const existing = (candidates ?? []).find((row: ResidentProfile) => {
    const storedDigits = String(row.phone ?? '').replace(/\D/g, '')
    return storedDigits === digits && storedDigits !== ''
  })
  return existing ?? null
}

export async function getOrCreateResidentProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<ResidentProfile | null> {
  const { data: residents, error: residentError } = await supabase
    .from('residents')
    .select(RESIDENT_PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (residentError) {
    const errorMessage = 'message' in residentError
      ? String(residentError.message)
      : JSON.stringify(residentError)
    logger.error('getOrCreateResidentProfile - SELECT error', new Error(errorMessage), { context: 'lib/residents', residentError })
    throw residentError
  }

  const existingResident = residents?.[0] ?? null
  if (existingResident) {
    const verificationAction = user.user_metadata?.verification_action
    if (
      verificationAction === 'auto_verify' &&
      existingResident.verification_status !== 'auto_verified' &&
      existingResident.verification_status !== 'id_verified'
    ) {
      await applyAutoVerification(supabase, existingResident.id)
    }
    return existingResident as ResidentProfile
  }

  const firstName = getUserField(user, 'first_name')
  const lastName = getUserField(user, 'last_name')
  // Barangay is a fixed system constant (Barangay Barretto), never a value to
  // trust from user metadata: metadata is client-writable and the database
  // enforces the single-barangay CHECK constraint (`residents_barangay_is_barretto`).
  // Canonicalize any stored spelling, and default blank/missing metadata to the
  // system barangay so profile creation never fails on it.
  const barangayFromMetadata = getUserField(user, 'barangay')
  const canonicalBarangay = canonicalBarangayName(barangayFromMetadata)
  const barangay = canonicalBarangay ?? BARANGAY_NAME
  if (barangayFromMetadata && !canonicalBarangay) {
    logger.warn('getOrCreateResidentProfile - overriding out-of-area barangay from user metadata', {
      context: 'lib/residents',
      userId: user.id,
      metadataBarangay: barangayFromMetadata,
      resolvedBarangay: barangay,
    })
  }
  const email = user.email?.trim() || getUserField(user, 'email')
  const phone = getUserPhone(user)
  const address = getUserAddress(user)
  const dateOfBirth = getUserField(user, 'date_of_birth') || null
  const nationalId = getUserField(user, 'national_id') || null
  const idType = getUserField(user, 'id_type') || null

  const missingFields: string[] = []
  if (!firstName) missingFields.push('first_name')
  if (!lastName) missingFields.push('last_name')
  if (!email) missingFields.push('email')

  if (missingFields.length > 0) {
    logger.warn('getOrCreateResidentProfile - Missing user metadata', { context: 'lib/residents', missingFields: missingFields.join(', ') })
    return null
  }

  const { data: createdResident, error: insertError } = await supabase
    .from('residents')
    .insert([
      {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address,
        barangay,
        date_of_birth: dateOfBirth,
        national_id: nationalId,
        id_type: idType,
      },
    ])
    .select(RESIDENT_PROFILE_COLUMNS)
    .single()

  if (insertError) {
    // The phone (and national_id) columns carry unique indexes on digits-only
    // normalization (`uq_residents_phone_normalized`). If another resident row
    // already owns this phone — e.g. the user re-signed up with a different
    // email, or a profile was created before the index existed — fall back to
    // returning that existing resident instead of crashing the dashboard.
    if (insertError.code === '23505' && phone) {
      const existingByPhone = await findResidentByPhone(supabase, phone)
      if (existingByPhone) {
        logger.warn('getOrCreateResidentProfile - phone already registered, returning existing resident', {
          context: 'lib/residents',
          userId: user.id,
          existingResidentId: existingByPhone.id,
          existingUserId: existingByPhone.user_id,
        })
        return existingByPhone as ResidentProfile
      }
    }

    const errorMessage = 'message' in insertError
      ? String(insertError.message)
      : JSON.stringify(insertError)
    logger.error('getOrCreateResidentProfile - INSERT error', new Error(errorMessage), { context: 'lib/residents', insertError })
    throw insertError
  }

  const verificationAction = user.user_metadata?.verification_action
  if (verificationAction === 'auto_verify' && createdResident) {
    await applyAutoVerification(supabase, createdResident.id)
    return { ...createdResident, verification_status: 'auto_verified' } as ResidentProfile
  }

  return createdResident as ResidentProfile
}
