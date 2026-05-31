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

export async function getOrCreateResidentProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<ResidentProfile | null> {
  const { data: residents, error: residentError } = await supabase
    .from('residents')
    .select('id, user_id, first_name, last_name, email, phone, address, barangay')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (residentError) {
    // Extract error details for better debugging
    const errorMessage = 'message' in residentError 
      ? String(residentError.message)
      : JSON.stringify(residentError)
    console.error('getOrCreateResidentProfile - SELECT error:', errorMessage, residentError)
    throw residentError
  }

  const existingResident = residents?.[0] ?? null
  if (existingResident) {
    return existingResident as ResidentProfile
  }

  const firstName = getUserField(user, 'first_name')
  const lastName = getUserField(user, 'last_name')
  const barangay = getUserField(user, 'barangay')
  const email = user.email?.trim() || getUserField(user, 'email')
  const phone = getUserPhone(user)
  const address = getUserAddress(user)

  // Check for missing metadata that prevents profile creation
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
    .select('id, user_id, first_name, last_name, email, phone, address, barangay')
    .single()

  if (insertError) {
    // Extract error details for better debugging
    const errorMessage = 'message' in insertError 
      ? String(insertError.message)
      : JSON.stringify(insertError)
    console.error('getOrCreateResidentProfile - INSERT error:', errorMessage, insertError)
    throw insertError
  }

  return createdResident as ResidentProfile
}