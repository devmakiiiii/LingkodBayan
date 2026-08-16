'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { redirect } from 'next/navigation'

const SIGNUP_COOKIE = 'signup_temp_data'
const COOKIE_MAX_AGE = 300

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.slice(0, 32)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  )
  return keyMaterial
}

async function encryptData(data: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(data)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptData(encrypted: string): Promise<string | null> {
  try {
    const key = await getEncryptionKey()
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}

export async function requestSignUpOtp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const middleName = formData.get('middleName') as string
  const dateOfBirth = formData.get('dateOfBirth') as string
  const barangay = formData.get('barangay') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const nationalId = formData.get('nationalId') as string
  const idType = formData.get('idType') as string
  const verificationAction = formData.get('verificationAction') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName || undefined,
        barangay,
        phone: phone || undefined,
        address: address || undefined,
        date_of_birth: dateOfBirth || undefined,
        national_id: nationalId || undefined,
        id_type: idType,
        role: 'citizen',
        verification_action: verificationAction || 'no_match',
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  const signupData = JSON.stringify({
    email,
    password,
    verificationAction: verificationAction || 'no_match',
    nationalId: nationalId || '',
  })

  const encrypted = await encryptData(signupData)
  const cookieStore = await cookies()
  cookieStore.set(SIGNUP_COOKIE, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  })

  redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
}

export async function completeSignUpVerification(formData: FormData) {
  const email = formData.get('email') as string
  const code = formData.get('code') as string

  const cookieStore = await cookies()
  const cookie = cookieStore.get(SIGNUP_COOKIE)?.value

  if (!cookie) {
    return { error: 'Sign-up session expired. Please try again.' }
  }

  const decrypted = await decryptData(cookie)
  if (!decrypted) {
    return { error: 'Invalid sign-up session. Please try again.' }
  }

  const signupData = JSON.parse(decrypted)
  const supabase = await createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await supabase.auth.updateUser({ password: signupData.password })
    await getOrCreateResidentProfile(supabase, data.user)
  }

  cookieStore.delete(SIGNUP_COOKIE)
  redirect('/citizen/dashboard')
}

export async function resendSignUpOtp(formData: FormData) {
  const email = formData.get('email') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'A new verification code has been sent to your email.' }
}
