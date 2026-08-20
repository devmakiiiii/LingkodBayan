'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { redirect } from 'next/navigation'
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/schemas'
import { rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'
import { logger } from '@/lib/logger'

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

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string

  try {
    const validated = forgotPasswordSchema.parse({ email })

    const headersList = await headers()
    const rateLimitResult = rateLimit({ interval: 60 * 1000, limit: 3 })({
      ip: headersList.get('x-forwarded-for') || undefined,
      headers: headersList as unknown as Headers,
    })

    if (!rateLimitResult.allowed) {
      return {
        error: `Too many password reset requests. Please try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
      }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
    })

    if (error) {
      logger.error('Password reset request failed', error, { context: 'auth', email: validated.email })
      return { error: error.message }
    }

    logger.info('Password reset email sent', { context: 'auth', email: validated.email })
    return { success: true, message: 'If an account exists with this email, a password reset link has been sent.' }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'ZodError') {
      return { error: (error as any).errors[0]?.message || 'Invalid email address' }
    }
    logger.error('Password reset request error', error, { context: 'auth' })
    return { error: 'Failed to process password reset request.' }
  }
}

export async function resetPassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  try {
    const validated = resetPasswordSchema.parse({ password, confirmPassword })

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Session expired. Please request a new password reset link.' }
    }

    const { error } = await supabase.auth.updateUser({
      password: validated.password,
    })

    if (error) {
      logger.error('Password reset failed', error, { context: 'auth', userId: user.id })
      return { error: error.message }
    }

    logger.info('Password reset successful', { context: 'auth', userId: user.id })
    return { success: true, message: 'Your password has been reset successfully.' }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'ZodError') {
      return { error: (error as any).errors[0]?.message || 'Invalid password' }
    }
    logger.error('Password reset error', error, { context: 'auth' })
    return { error: 'Failed to reset password.' }
  }
}
