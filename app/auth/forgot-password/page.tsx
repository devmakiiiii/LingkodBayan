'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/app/actions/auth'
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.append('email', email)

    const result = await requestPasswordReset(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.success) {
      setSuccess(true)
      setEmail('')
    }
    setIsLoading(false)
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

            <h2 className="text-lg font-semibold text-gray-800 mb-2">Forgot Password?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            {success ? (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
                If an account exists with this email, a password reset link has been sent.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4 mb-6">
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
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{' '}
                <Link href="/auth/login" className="text-[#28A745] font-semibold hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
