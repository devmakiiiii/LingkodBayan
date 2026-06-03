'use client'

import { createClient } from '@/lib/supabase/client'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { getOrCreateResidentProfile } from '@/lib/residents'
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
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [barangay, setBarangay] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null)
  const router = useRouter()

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitCountdown === null) return
    
    if (rateLimitCountdown <= 0) {
      setRateLimitCountdown(null)
      return
    }
    
    const timer = setTimeout(() => {
      setRateLimitCountdown(rateLimitCountdown - 1)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [rateLimitCountdown])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasSupabaseConfig()) {
      setError('Supabase is not configured for local preview. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to enable sign-up.')
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            barangay,
            phone: phone || undefined,
            address: address || undefined,
            role: 'citizen',
          },
        },
      })
      if (error) throw error

      if (data.user && data.session) {
        await getOrCreateResidentProfile(supabase, data.user)
        router.push('/citizen/dashboard')
        return
      }

      router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
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
        setRateLimitCountdown(retrySeconds)
        setError(`Rate limit exceeded. Please wait ${retrySeconds} seconds before trying again.`)
      } else {
        setError(err?.message || 'An error occurred during sign-up')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-170">
        <div className="bg-white rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8 md:p-10">
            {/* Logo Section */}
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
              <p className="text-xs text-gray-500 mt-1">Create Your Account</p>
            </div>

            {/* Sign Up Form */}
            <form onSubmit={handleSignUp}>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="first-name" className="text-sm font-medium text-gray-700">
                    First Name
                  </Label>
                  <Input
                    id="first-name"
                    type="text"
                    placeholder="Juan"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="last-name" className="text-sm font-medium text-gray-700">
                    Last Name
                  </Label>
                  <Input
                    id="last-name"
                    type="text"
                    placeholder="Dela Cruz"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>
              </div>

              <div className="space-y-4 mb-4">
                {/* Email */}
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
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Barangay */}
                <div className="space-y-2">
                  <Label htmlFor="barangay" className="text-sm font-medium text-gray-700">
                    Barangay
                  </Label>
                  <Input
                    id="barangay"
                    type="text"
                    placeholder="e.g., Barangay 1"
                    required
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="09XX XXX XXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Complete Address
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="Purok, Street, Block/Lot number"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="repeat-password" className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2.5">
                <Button
                  type="submit"
                  disabled={isLoading || rateLimitCountdown !== null}
                  className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {isLoading ? 'Creating account...' : 
                   rateLimitCountdown !== null ? `Wait ${rateLimitCountdown}s...` : 'Create Account'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => router.push('/')}
                >
                  Back to Home
                </Button>
              </div>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-[#28A745] font-semibold hover:underline">
                    Sign In
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
