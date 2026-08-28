'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resetPassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        setHasSession(!!session)
      } catch {
        setHasSession(false)
      } finally {
        setIsCheckingSession(false)
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.append('password', password)
    formData.append('confirmPassword', confirmPassword)

    const result = await resetPassword(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/auth/login?reset=success')
      }, 1500)
    }
    setIsLoading(false)
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
        <div className="w-full max-w-95">
          <div className="bg-white rounded-[12px] shadow-2xl overflow-hidden">
            <div className="p-8 text-center">
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
                <p className="text-xs text-gray-500 mt-1">Civic Services Portal</p>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Verifying Link...</h2>
              <p className="text-sm text-gray-600 mb-6">
                Please wait while we verify your password reset link.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!hasSession && !success) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
        <div className="w-full max-w-95">
          <div className="bg-white rounded-[12px] shadow-2xl overflow-hidden">
            <div className="p-8 text-center">
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
                <p className="text-xs text-gray-500 mt-1">Civic Services Portal</p>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Invalid or Expired Link</h2>
              <p className="text-sm text-gray-600 mb-6">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Button
                onClick={() => router.push('/auth/forgot-password')}
                className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                Request New Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
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
              <p className="text-xs text-gray-500 mt-1">Civic Services Portal</p>
            </div>

            {success ? (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Password Updated</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
                <Button
                  onClick={() => router.push('/auth/login?reset=success')}
                  className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  Go to Sign In
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Reset Password</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Enter your new password below.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                        New Password
                      </Label>
                      <PasswordInput
                        id="password"
                        placeholder="••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                        Confirm New Password
                      </Label>
                      <PasswordInput
                        id="confirmPassword"
                        placeholder="••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
                    >
                      {isLoading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
