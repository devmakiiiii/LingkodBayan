'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { getOrCreateResidentProfile } from '@/lib/residents'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

function normalizeCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export default function Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialEmail = useMemo(() => searchParams.get('email') ?? '', [searchParams])

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendDisabled, setResendDisabled] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasSupabaseConfig()) {
      setError('Supabase is not configured for local preview. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to enable verification.')
      return
    }

    if (!email.trim()) {
      setError('Enter the email address used during sign up.')
      return
    }

    if (code.length !== 6 && code.length !== 8) {
      setError('Enter the 6 or 8-digit code from your email.')
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'email',
      })

      if (error) throw error

      if (data.user) {
        await getOrCreateResidentProfile(supabase, data.user)
      }

      router.replace('/citizen/dashboard')
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
        setError(`Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`)
      } else {
        setError(err?.message || 'An error occurred while verifying the code.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (!hasSupabaseConfig()) {
      setError('Supabase is not configured for local preview. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to enable resending codes.')
      return
    }

    if (!email.trim()) {
      setError('Enter the email address used during sign up before resending the code.')
      return
    }

    const supabase = createClient()
    setIsResending(true)
    setResendDisabled(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })

      if (error) throw error

      setMessage('A new verification code has been sent to your email.')
      // Re-enable resend button after 30 seconds
      setTimeout(() => setResendDisabled(false), 30000)
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
        
        setError(`Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`)
        setResendDisabled(true)
        setTimeout(() => setResendDisabled(false), retrySeconds * 1000)
      } else {
        setError(err?.message || 'An error occurred while resending the code.')
        setResendDisabled(false)
      }
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-95">
        <div className="bg-white rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
                <Image
                  src="/lingkod-logo.png"
                  alt="LingkodBayan logo"
                  width={88}
                  height={88}
                  className="h-20 w-20 object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-wide">LINGKOD BAYAN</h1>
              <p className="text-xs text-gray-500 mt-1">Verify Your Email</p>
            </div>

            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-2xl text-center">Enter your verification code</CardTitle>
                <CardDescription className="text-center">
                  We sent a numeric verification code to your email. Enter it below to finish creating your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="juan@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                      Verification Code
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      required
                      value={code}
                      onChange={(e) => setCode(normalizeCode(e.target.value))}
                      maxLength={8}
                      className="bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm tracking-[0.35em] text-center focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm">
                      {message}
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
                    >
                      {isLoading ? 'Verifying...' : 'Verify Code'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isResending || resendDisabled}
                      className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={handleResend}
                    >
                      {isResending ? 'Resending...' : 'Resend Code'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => router.push('/auth/sign-up')}
                    >
                      Back to Sign Up
                    </Button>
                  </div>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                  Didn&apos;t receive the code? Check your spam folder or try resending it.
                </p>

                <div className="mt-4 text-center">
                  <Link href="/auth/login" className="text-[#28A745] font-semibold hover:underline text-sm">
                    I already verified my account
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}