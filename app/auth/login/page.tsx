'use client'

import { createClient } from '@/lib/supabase/client'
import { hasSupabaseConfig } from '@/lib/supabase/client'
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
import { useState } from 'react'

export default function Page() {
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
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      
      // Check user role and redirect accordingly
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/citizen/dashboard')
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-95">
        <div className="bg-white rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8">
            {/* Logo Section */}
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
                <Image
                  src="/barangay.png"
                  alt="Barangay logo"
                  width={88}
                  height={88}
                  className="h-20 w-20 object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-wide">LINGKOD BAYAN</h1>
              <p className="text-xs text-gray-500 mt-1">Civic Services Portal</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-4 mb-6">
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
                    className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
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
                    className="bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
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
                  disabled={isLoading}
                  className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
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
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/auth/sign-up" className="text-[#28A745] font-semibold hover:underline">
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
