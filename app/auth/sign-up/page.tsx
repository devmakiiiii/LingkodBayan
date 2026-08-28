'use client'

import { requestSignUpOtp, resendSignUpOtp } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { OLONGAPO_BARANGAYS, signUpSchema } from '@/lib/schemas'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [barangay, setBarangay] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [idType, setIdType] = useState('philsys')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingMatch, setIsCheckingMatch] = useState(false)
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null)
  const [matchResult, setMatchResult] = useState<{
    matched: boolean
    confidence: number
    action: 'auto_verify' | 'id_verify' | 'needs_review' | 'no_match'
    matchedResident?: { firstName: string; lastName: string; email: string; barangay: string } | null
  } | null>(null)
  const router = useRouter()
  const matchRequestIdRef = useRef(0)

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

  const checkVerificationMatch = useCallback(async () => {
    if (!email || !firstName || !lastName) {
      return
    }

    setIsCheckingMatch(true)
    setError(null)
    setMatchResult(null)

    try {
      const requestId = ++matchRequestIdRef.current

      const response = await fetch('/api/verification/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          middleName,
          email,
          phone,
          address,
          barangay,
          dateOfBirth,
          nationalId,
        }),
      })

      const result = await response.json()

      if (requestId !== matchRequestIdRef.current) {
        return
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check verification match')
      }

      setMatchResult(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check verification'
      setError(message)
    } finally {
      setIsCheckingMatch(false)
    }
  }, [email, firstName, lastName, middleName, phone, address, barangay, dateOfBirth, nationalId])

  useEffect(() => {
    if (firstName && lastName && email) {
      const timer = setTimeout(() => {
        checkVerificationMatch()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [firstName, lastName, email, checkVerificationMatch])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    const barangayResult = signUpSchema.shape.barangay.safeParse(barangay)
    if (!barangayResult.success) {
      setError(barangayResult.error.issues[0]?.message ?? 'Please select a barangay')
      setIsLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('password', password)
      formData.append('firstName', firstName)
      formData.append('lastName', lastName)
      formData.append('middleName', middleName)
      formData.append('dateOfBirth', dateOfBirth)
      formData.append('barangay', barangay)
      formData.append('phone', phone)
      formData.append('address', address)
      formData.append('nationalId', nationalId)
      formData.append('idType', idType)
      formData.append('verificationAction', matchResult?.action || 'no_match')

      const result = await requestSignUpOtp(formData)

      if (result && 'error' in result) {
        setError(result.error)
        setIsLoading(false)
        return
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during sign-up'
      setError(message)
      setIsLoading(false)
    }
  }

  const getMatchStatusDisplay = () => {
    if (isCheckingMatch) {
      return (
        <div className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking against pre-registered data...</span>
        </div>
      )
    }

    if (!matchResult) return null

    if (matchResult.action === 'auto_verify') {
      return (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>Your details match our records. Your account will be auto-verified.</span>
        </div>
      )
    }

    if (matchResult.action === 'id_verify') {
      return (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Partial match found ({Math.round(matchResult.confidence)}% confidence). You may need to upload an ID after sign-up.</span>
        </div>
      )
    }

    if (matchResult.action === 'needs_review') {
      return (
        <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-200 px-4 py-2.5 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Your details need manual review ({Math.round(matchResult.confidence)}% confidence). You may need to upload an ID after sign-up.</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 text-gray-700 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>No match found in pre-registered data. You can still sign up, but you may need to upload an ID for verification.</span>
      </div>
    )
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

                {/* Middle Name */}
                <div className="space-y-2">
                  <Label htmlFor="middle-name" className="text-sm font-medium text-gray-700">
                    Middle Name
                  </Label>
                  <Input
                    id="middle-name"
                    type="text"
                    placeholder="Santos"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label htmlFor="date-of-birth" className="text-sm font-medium text-gray-700">
                    Date of Birth
                  </Label>
                  <Input
                    id="date-of-birth"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
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
                  <Select value={barangay || undefined} onValueChange={setBarangay} required>
                    <SelectTrigger
                      id="barangay"
                      className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                    >
                      <SelectValue placeholder="Select your barangay" />
                    </SelectTrigger>
                    <SelectContent>
                      {OLONGAPO_BARANGAYS.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                {/* National ID */}
                <div className="space-y-2">
                  <Label htmlFor="national-id" className="text-sm font-medium text-gray-700">
                    National ID (Optional)
                  </Label>
                  <Input
                    id="national-id"
                    type="text"
                    placeholder="12-digit PhilSys number"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                  />
                </div>

                {/* ID Type */}
                <div className="space-y-2">
                  <Label htmlFor="id-type" className="text-sm font-medium text-gray-700">
                    ID Type
                  </Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="philsys">PhilSys (Philhealth ID)</SelectItem>
                      <SelectItem value="drivers_license">Driver's License</SelectItem>
                      <SelectItem value="voter">Voter's ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="umid">UMID</SelectItem>
                      <SelectItem value="sss">SSS ID</SelectItem>
                      <SelectItem value="tin">TIN ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                 <PasswordInput
                   id="password"
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
                 <PasswordInput
                   id="repeat-password"
                   placeholder="••••••••"
                   required
                   value={repeatPassword}
                   onChange={(e) => setRepeatPassword(e.target.value)}
                   className="w-full bg-[#E8F4FD] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#28A745]"
                 />
                </div>

                {/* Verification Match Status */}
                <div className="pt-2">
                  {getMatchStatusDisplay()}
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
