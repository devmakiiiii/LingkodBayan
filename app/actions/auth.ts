'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { redirect } from 'next/navigation'
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/schemas'
import { durableRateLimit } from '@/lib/rate-limit-durable'
import { headers } from 'next/headers'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { findDuplicateResidentAccounts } from '@/lib/db'

const SIGNUP_COOKIE = 'signup_temp_data'
const COOKIE_MAX_AGE = 300

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!secret) {
    throw new Error('Missing Supabase key material for encrypting temporary signup data.')
  }
  // Derive a uniformly distributed 256-bit key from the secret instead of
  // truncating it, so the AES key does not inherit the secret's byte layout.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
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

  // Durable limit: cap OTP emails per address so this endpoint cannot be used
  // to spam residents or exhaust the Supabase auth email quota. Enforced in
  // Postgres (falls back to in-memory if the migration is not applied yet).
  const otpRateLimit = await durableRateLimit(`signup-otp:${email.toLowerCase()}`, {
    intervalMs: 10 * 60 * 1000,
    limit: 5,
  })
  if (!otpRateLimit.allowed) {
    return {
      error:
        'Too many verification codes were requested for this email. Please wait 10 minutes before trying again, or contact the barangay office for help.',
    }
  }

  const supabase = await createClient()

  // Duplicate-identity gate: block sign-up when the same person already has a
  // registered resident account (same national ID, phone, or name + DOB),
  // even if they use a different email address. The residents table is
  // RLS-scoped, so this lookup requires the service-role client. A failed
  // check must never hard-block registration, so errors are logged and the
  // sign-up continues.
  try {
    const adminClient = createAdminClient()
    const duplicates = await findDuplicateResidentAccounts(
      {
        email,
        phone,
        nationalId,
        firstName,
        lastName,
        dateOfBirth,
      },
      adminClient,
    )

    if (duplicates.length > 0) {
      const matchedOn = duplicates[0].matchedOn.join(', ')
      logger.warn('Sign-up blocked: duplicate resident identity detected', {
        context: 'auth',
        email,
        matchedOn,
        duplicateCount: duplicates.length,
      })
      return {
        error:
          'Our records show an account already exists with these personal details (matching your national ID, phone number, or name and date of birth). Only one account per resident is allowed. Please sign in to your existing account instead, or contact the barangay office if you believe this is a mistake.',
      }
    }
  } catch (duplicateCheckError: unknown) {
    logger.error('Duplicate resident check failed', duplicateCheckError, { context: 'auth', email })
  }

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

    // Durable limit: enforced in Postgres so the cap holds across serverless
    // instances (keyed by email AND client IP; either tripping it blocks).
    const headersList = await headers()
    const clientIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitResult = await durableRateLimit(`pwreset:${validated.email.toLowerCase()}:${clientIp}`, {
      intervalMs: 60 * 1000,
      limit: 3,
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
