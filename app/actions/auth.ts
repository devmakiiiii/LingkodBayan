'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { redirect } from 'next/navigation'
import { BARANGAY_NAME, forgotPasswordSchema, loginSchema, resetPasswordSchema } from '@/lib/schemas'
import { durableRateLimit } from '@/lib/rate-limit-durable'
import { headers } from 'next/headers'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { findDuplicateResidentAccounts, isEmailRegisteredToResident } from '@/lib/db'
import { ZodError } from 'zod'

const SIGNUP_COOKIE = 'signup_temp_data'
const COOKIE_MAX_AGE = 300

async function getEncryptionKey(): Promise<CryptoKey> {
  // Server-only secret, and no fallback: the sign-up cookie carries the account
  // password, so deriving the AES key from the public anon key would make the
  // ciphertext readable by anyone who holds the cookie.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY: temporary sign-up data cannot be encrypted.')
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
  // Trimmed server-side too: the form trims before posting, but the action is a
  // public endpoint and must not mint an account for " juan@example.com ".
  const email = ((formData.get('email') as string | null) ?? '').trim()
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const middleName = formData.get('middleName') as string
  const dateOfBirth = formData.get('dateOfBirth') as string
  // Single-barangay system: every resident belongs to Barangay Barretto, so the
  // barangay is pinned here instead of trusting a posted value.
  const barangay = BARANGAY_NAME
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const nationalId = formData.get('nationalId') as string
  const idType = formData.get('idType') as string
  const verificationAction = formData.get('verificationAction') as string

  // Credential gate on the server: the wizard validates these client-side, but
  // this action is a public endpoint and must enforce the same rules itself.
  const credentials = loginSchema.safeParse({ email, password })
  if (!credentials.success) {
    return { error: credentials.error.issues[0]?.message ?? 'Enter a valid email address and password.' }
  }

  // Fail closed: this action needs the service-role key both for the identity
  // checks below and for encrypting the temporary sign-up cookie.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('Sign-up unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured', undefined, {
      context: 'auth',
    })
    return {
      error: 'Sign-up is temporarily unavailable. Please try again later or contact the barangay office.',
    }
  }

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

    // Returning residents must sign in rather than walk through sign-up: Supabase
    // never reports "already registered" for `signInWithOtp`, so without this the
    // flow would re-issue a code for the account they already own and then
    // overwrite its password.
    if (await isEmailRegisteredToResident(email, adminClient)) {
      logger.warn('Sign-up blocked: email already belongs to a registered resident', {
        context: 'auth',
        email,
      })
      return {
        error:
          'An account with this email already exists. Please sign in instead, or use "Forgot password?" if you cannot remember your password.',
      }
    }

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
        // Informational only. Authorization reads `app_metadata.role`, because
        // user metadata (this object) is writable by the account holder.
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
  const email = ((formData.get('email') as string | null) ?? '').trim()
  const code = ((formData.get('code') as string | null) ?? '').trim()

  if (!email || !code) {
    return { error: 'Enter the verification code we emailed you.' }
  }

  // Durable limit: a short numeric code is guessable at volume, so cap attempts
  // per address in Postgres (falls back to in-memory if the migration is
  // missing). Every attempt counts, matching the password-reset limiter.
  const verifyRateLimit = await durableRateLimit(`signup-verify:${email.toLowerCase()}`, {
    intervalMs: 10 * 60 * 1000,
    limit: 10,
  })
  if (!verifyRateLimit.allowed) {
    return {
      error:
        'Too many verification attempts for this email. Please wait 10 minutes and try again, or contact the barangay office for help.',
    }
  }

  const cookieStore = await cookies()
  const cookie = cookieStore.get(SIGNUP_COOKIE)?.value

  if (!cookie) {
    return { error: 'Sign-up session expired. Please try again.' }
  }

  const decrypted = await decryptData(cookie)
  if (!decrypted) {
    return { error: 'Invalid sign-up session. Please try again.' }
  }

  const signupData = JSON.parse(decrypted) as {
    email?: string
    password?: string
    verificationAction?: string
    nationalId?: string
  }

  // The temporary password rides in the cookie for the address that started the
  // sign-up, so refuse to apply it to a different address than the one posted.
  if (
    typeof signupData.email !== 'string' ||
    signupData.email.trim().toLowerCase() !== email.toLowerCase()
  ) {
    return {
      error:
        'This code was requested from a different sign-up session. Please start again from the sign-up page.',
    }
  }

  if (typeof signupData.password !== 'string' || !signupData.password) {
    return { error: 'Sign-up session expired. Please try again.' }
  }

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
  const email = ((formData.get('email') as string | null) ?? '').trim()

  if (!email) {
    return { error: 'Enter the email address you signed up with.' }
  }

  // The verify screen only disables the resend button for 30 seconds, which is
  // trivially bypassed, so cap resends per address on the server too.
  const resendRateLimit = await durableRateLimit(`signup-otp-resend:${email.toLowerCase()}`, {
    intervalMs: 10 * 60 * 1000,
    limit: 5,
  })
  if (!resendRateLimit.allowed) {
    return {
      error:
        'Too many verification codes were requested for this email. Please wait 10 minutes before trying again, or contact the barangay office for help.',
    }
  }

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
  const email = ((formData.get('email') as string | null) ?? '').trim()

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
    if (error instanceof ZodError) {
      return { error: error.issues[0]?.message || 'Invalid email address' }
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
    if (error instanceof ZodError) {
      return { error: error.issues[0]?.message || 'Invalid password' }
    }
    logger.error('Password reset error', error, { context: 'auth' })
    return { error: 'Failed to reset password.' }
  }
}
