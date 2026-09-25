'use client'

import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import Image from 'next/image'
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

function SignInForm() {
  const searchParams = useSearchParams()
  const resetPasswordSuccess = searchParams.get('reset') === 'success'
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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Check user role and redirect accordingly
      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.user_metadata?.role || user?.app_metadata?.role
      const target = role === 'admin' || role === 'super_admin' ? '/admin/dashboard' : '/citizen/dashboard'
      // Keep the button disabled until navigation finishes so the form cannot be
      // resubmitted, and use replace so Back does not return to the login form.
      router.replace(target)
    } catch (error: unknown) {
      const err = error as any

      // Check for rate limit error (429) - check multiple possible properties
      const isRateLimited = err?.status === 429 ||
                            err?.code === '429' ||
                            err?.code === 'rate_limit_exceeded' ||
                            (typeof err?.message === 'string' && err.message.includes('Too Many Requests')) ||
                            (typeof err?.message === 'string' && err.message.includes('rate_limit')) ||
                            err?.name === 'RateLimitError'

      if (isRateLimited) {
        const retryAfterHeader = err?.headers?.['retry-after'] || err?.headers?.['Retry-After']
        const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30
        setError(`Too many attempts. Please wait ${retrySeconds} seconds before trying again.`)
      } else {
        setError(friendlyLoginError(typeof err?.message === 'string' ? err.message : ''))
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-95">
        <div className="bg-white dark:bg-card border border-transparent dark:border-border rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-muted-foreground dark:hover:text-card-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>

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
