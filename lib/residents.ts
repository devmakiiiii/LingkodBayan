import type { SupabaseClient, User } from '@supabase/supabase-js'

type ResidentProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  barangay: string
}

function getUserField(user: User, key: string) {
  return typeof user.user_metadata?.[key] === 'string'
    ? String(user.user_metadata[key]).trim()
    : ''
}

export async function getOrCreateResidentProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<ResidentProfile | null> {
  const { data: residents, error: residentError } = await supabase
    .from('residents')
    .select('id, user_id, first_name, last_name, email, barangay')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (residentError) {
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

  if (!firstName || !lastName || !barangay || !email) {
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
        barangay,
      },
    ])
    .select('id, user_id, first_name, last_name, email, barangay')
    .single()

  if (insertError) {
    throw insertError
  }

  return createdResident as ResidentProfile
}