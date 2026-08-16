import type { SupabaseClient, User } from '@supabase/supabase-js'

type ResidentProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  address?: string | null
  barangay: string
}

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
    console.error('applyAutoVerification - update error:', updateError)
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
    console.error('applyAutoVerification - log error:', logError)
  }
}

export async function getOrCreateResidentProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<ResidentProfile | null> {
  const { data: residents, error: residentError } = await supabase
    .from('residents')
    .select('id, user_id, first_name, last_name, email, phone, address, barangay, verification_status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (residentError) {
    const errorMessage = 'message' in residentError
      ? String(residentError.message)
      : JSON.stringify(residentError)
    console.error('getOrCreateResidentProfile - SELECT error:', errorMessage, residentError)
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
  const barangay = getUserField(user, 'barangay')
  const email = user.email?.trim() || getUserField(user, 'email')
  const phone = getUserPhone(user)
  const address = getUserAddress(user)

  const missingFields: string[] = []
  if (!firstName) missingFields.push('first_name')
  if (!lastName) missingFields.push('last_name')
  if (!barangay) missingFields.push('barangay')
  if (!email) missingFields.push('email')

  if (missingFields.length > 0) {
    console.warn('getOrCreateResidentProfile - Missing user metadata:', missingFields.join(', '))
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
      },
    ])
    .select('id, user_id, first_name, last_name, email, phone, address, barangay, verification_status')
    .single()

  if (insertError) {
    const errorMessage = 'message' in insertError
      ? String(insertError.message)
      : JSON.stringify(insertError)
    console.error('getOrCreateResidentProfile - INSERT error:', errorMessage, insertError)
    throw insertError
  }

  const verificationAction = user.user_metadata?.verification_action
  if (verificationAction === 'auto_verify' && createdResident) {
    await applyAutoVerification(supabase, createdResident.id)
    return { ...createdResident, verification_status: 'auto_verified' } as ResidentProfile
  }

  return createdResident as ResidentProfile
}
