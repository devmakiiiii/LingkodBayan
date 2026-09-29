'use client'

import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { LocaleToggle } from '@/components/citizen/locale-toggle'
import { getUserRole, isAdminRole } from '@/lib/roles'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

const inputClassName =
  'w-full bg-white dark:bg-input/30 border border-gray-300 dark:border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#228039]'

const linkClassName = 'font-semibold text-[#228039] hover:underline dark:text-[#4ADE80]'

function friendlyLoginError(message: string): string {
  if (!message) return 'Something went wrong. Please try again.'

  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in. Check your inbox for the confirmation link.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many sign-in attempts. Please wait a moment before trying again.'
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Unable to reach the server. Please check your internet connection and try again.'
  }
  return message
}

/**
 * Only same-origin, relative paths are honoured for `?next=`, so a crafted
 * sign-in link cannot turn the form into an open redirect.
 */
function safeRedirectTarget(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  // Backslashes are normalised to slashes by some browsers, so reject them.
  if (value.includes('\\')) return null
  return value
}

function SignInForm() {
  const searchParams = useSearchParams()
  const resetPasswordSuccess = searchParams.get('reset') === 'success'
  const nextTarget = safeRedirectTarget(searchParams.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasSupabaseConfig()) {
      setError('Supabase is not configured for local preview. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to enable login.')
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    // Supabase treats the address literally, so trim it: a pasted address with a
    // trailing space would otherwise fail as "invalid login credentials".
    const trimmedEmail = email.trim()

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })
      if (error) throw error

      // Role is resolved from app_metadata only — user_metadata is writable by
      // the account holder, so it cannot be trusted for routing/authorization.
      const { data: { user } } = await supabase.auth.getUser()
      const target = isAdminRole(getUserRole(user)) ? '/admin/dashboard' : '/citizen/dashboard'
      // Prefer the page they were originally bounced from (middleware adds
      // ?next=); middleware re-checks their role for that destination.
      // Keep the button disabled until navigation finishes so the form cannot be
      // resubmitted, and use replace so Back does not return to the login form.
      router.replace(nextTarget ?? target)
    } catch (error: unknown) {
      const err = error as { message?: unknown; status?: unknown; code?: unknown; name?: unknown }
      const message = typeof err?.message === 'string' ? err.message : ''

      // Supabase surfaces throttling as 429 or "rate limit exceeded"; its
      // AuthApiError carries no retry-after header, so the wait time cannot be
      // read from the response and the guidance stays generic.
      const isRateLimited =
        err?.status === 429 ||
        err?.code === '429' ||
        err?.code === 'rate_limit_exceeded' ||
        err?.name === 'RateLimitError' ||
        /too many requests|rate.?limit/i.test(message)

      setError(
        isRateLimited
          ? 'Too many sign-in attempts. Please wait a few minutes before trying again.'
          : friendlyLoginError(message),
      )
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-95">
        <div className="bg-white dark:bg-card border border-transparent dark:border-border rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-muted-foreground dark:hover:text-card-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>
              <LocaleToggle />
            </div>

            {/* Logo Section */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 dark:bg-muted dark:ring-border">
                <Image
                  src="/lingkod-logo.png"
                  alt="LingkodBayan logo"
                  width={88}
                  height={88}
                  className="h-20 w-20 object-contain"
                  priority
                />
              </div>
              <p className="text-xs font-semibold tracking-[0.2em] text-gray-500 dark:text-muted-foreground">
                LINGKOD BAYAN
              </p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-card-foreground tracking-wide">
                Sign in
              </h1>
              <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">Civic Services Portal</p>
            </div>

            {resetPasswordSuccess && (
              <div
                role="status"
                className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Your password has been updated. You can now sign in with your new password.</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-4 mb-6">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@example.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError(null)
                    }}
                    className={inputClassName}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password
                    </Label>
                    <Link href="/auth/forgot-password" className={`text-sm ${linkClassName}`}>
                      Forgot Password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(null)
                    }}
                    className={inputClassName}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div
                    role="alert"
                    className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-lg text-sm"
                  >
                    {error}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2.5">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#228039] hover:bg-[#1B6630] text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/auth/sign-up" className={linkClassName}>
                  Sign Up
                </Link>
              </p>
            </div>



          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
