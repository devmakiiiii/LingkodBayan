'use client'

import { completeSignUpVerification, resendSignUpOtp } from '@/app/actions/auth'
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
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('code', code)

      const result = await completeSignUpVerification(formData)

      if (result && 'error' in result) {
        setError(result.error ?? 'An error occurred while verifying the code.')
        setIsLoading(false)
        return
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while verifying the code.'
      setError(message)
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setResendDisabled(true)
    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('email', email)

      const result = await resendSignUpOtp(formData)

      if (result && 'error' in result) {
        setError(result.error ?? 'An error occurred while resending the code.')
        setResendDisabled(false)
        return
      }

      setMessage('A new verification code has been sent to your email.')
      setTimeout(() => setResendDisabled(false), 30000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while resending the code.'
      setError(message)
      setResendDisabled(false)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-95">
        <div className="bg-white dark:bg-card dark:border-border rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white dark:bg-card dark:bg-muted shadow-sm ring-1 ring-gray-200 dark:ring-border">
                <Image
                  src="/lingkod-logo.png"
                  alt="LingkodBayan logo"
                  width={88}
                  height={88}
                  className="h-20 w-20 object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground dark:text-card-foreground tracking-wide">LINGKOD BAYAN</h1>
              <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Verify Your Email</p>
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
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-card-foreground">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="juan@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-[#E8F4FD] dark:bg-input/30 border border-gray-300 dark:border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-card-foreground">
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
                      className="bg-[#E8F4FD] dark:bg-input/30 border border-gray-300 dark:border-input rounded-xl px-4 py-2.5 text-sm tracking-[0.35em] text-center focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 px-4 py-2.5 rounded-lg text-sm">
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
                      className="w-full border border-gray-300 dark:border-input dark:border-border text-gray-700 dark:text-gray-300 dark:text-card-foreground font-medium py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-muted dark:hover:bg-muted transition-colors"
                      onClick={handleResend}
                    >
                      {isResending ? 'Resending...' : 'Resend Code'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border border-gray-300 dark:border-input dark:border-border text-gray-700 dark:text-gray-300 dark:text-card-foreground font-medium py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-muted dark:hover:bg-muted transition-colors"
                      onClick={() => router.push('/auth/sign-up')}
                    >
                      Back to Sign Up
                    </Button>
                  </div>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600 dark:text-muted-foreground">
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