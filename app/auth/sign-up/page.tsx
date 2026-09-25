'use client'

import { requestSignUpOtp } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loginSchema, OLONGAPO_BARANGAYS, signUpBarangaySchema } from '@/lib/schemas'

const TODAY = new Date().toISOString().split('T')[0]

const linkClassName = 'font-semibold text-[#228039] hover:underline dark:text-[#4ADE80]'

const inputClassName = (hasError?: boolean) =>
  hasError
    ? 'w-full bg-white dark:bg-input/30 border border-red-400 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300'
    : 'w-full bg-white dark:bg-input/30 border border-gray-300 dark:border-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#228039]'

const STEP_TITLES = ['Your account', 'Where you live', 'Secure your account'] as const

type Step = 1 | 2 | 3

type FieldErrors = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'dateOfBirth'
    | 'email'
    | 'barangay'
    | 'phone'
    | 'password'
    | 'repeatPassword'
    | 'consent',
    string
  >
>

const FIELD_IDS: Record<string, string> = {
  firstName: 'first-name',
  lastName: 'last-name',
  dateOfBirth: 'date-of-birth',
  email: 'email',
  barangay: 'barangay',
  phone: 'phone',
  password: 'password',
  repeatPassword: 'repeat-password',
  consent: 'consent',
}

const STEP_FIELDS: Record<Step, (keyof FieldErrors)[]> = {
  1: ['firstName', 'lastName', 'dateOfBirth', 'email'],
  2: ['barangay', 'phone'],
  3: ['password', 'repeatPassword', 'consent'],
}

type SignUpValues = {
  firstName: string
  lastName: string
  dateOfBirth: string
  email: string
  barangay: string
  phone: string
  password: string
  repeatPassword: string
  consent: boolean
}

function validateStep1(v: SignUpValues): FieldErrors {
  const errors: FieldErrors = {}
  if (v.firstName.trim().length < 2) errors.firstName = 'First name is required'
  if (v.lastName.trim().length < 2) errors.lastName = 'Last name is required'
  if (!v.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required'
  } else if (v.dateOfBirth > TODAY) {
    errors.dateOfBirth = 'Date of birth cannot be in the future'
  }
  if (!v.email.trim()) {
    errors.email = 'Email address is required'
  } else {
    const parsed = loginSchema.shape.email.safeParse(v.email.trim())
    if (!parsed.success) errors.email = parsed.error.issues[0]?.message ?? 'Invalid email address'
  }
  return errors
}

function validateStep2(v: SignUpValues): FieldErrors {
  const errors: FieldErrors = {}
  const barangayResult = signUpBarangaySchema.safeParse(v.barangay)
  if (!barangayResult.success) {
    errors.barangay = barangayResult.error.issues[0]?.message ?? 'Please select a barangay'
  }
  if (v.phone.trim()) {
    const digits = v.phone.replace(/\D/g, '')
    if (!/^09\d{9}$/.test(digits) && !/^639\d{9}$/.test(digits)) {
      errors.phone = 'Enter a valid Philippine mobile number (e.g., 0917 123 4567)'
    }
  }
  return errors
}

function validateStep3(v: SignUpValues): FieldErrors {
  const errors: FieldErrors = {}
  if (!v.password) {
    errors.password = 'Password is required'
  } else {
    const parsed = loginSchema.shape.password.safeParse(v.password)
    if (!parsed.success) errors.password = parsed.error.issues[0]?.message ?? 'Password must be at least 6 characters'
  }
  if (!v.repeatPassword) {
    errors.repeatPassword = 'Please confirm your password'
  } else if (v.password !== v.repeatPassword) {
    errors.repeatPassword = "Passwords don't match"
  }
  if (!v.consent) errors.consent = 'Please consent to continue'
  return errors
}

function friendlySignUpError(message: string): string {
  if (!message) return 'Something went wrong. Please try again.'

  const normalized = message.toLowerCase()
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (normalized.includes('invalid email') || normalized.includes('valid email')) {
    return 'Please enter a valid email address.'
  }
  return message
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  )
}

type MatchResult = {
  matched: boolean
  confidence: number
  action: 'auto_verify' | 'id_verify' | 'needs_review' | 'no_match'
  matchedResident?: { firstName: string; lastName: string; email: string; barangay: string } | null
}

export default function Page() {
  const [step, setStep] = useState<Step>(1)
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
  const [consent, setConsent] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingMatch, setIsCheckingMatch] = useState(false)
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [matchNotice, setMatchNotice] = useState<string | null>(null)
  const matchRequestIdRef = useRef(0)
  const matchResultRef = useRef<MatchResult | null>(null)
  const isCheckingMatchRef = useRef(false)

  const values: SignUpValues = {
    firstName,
    lastName,
    dateOfBirth,
    email,
    barangay,
    phone,
    password,
    repeatPassword,
    consent,
  }

  const updateMatchResult = useCallback((result: MatchResult | null) => {
    matchResultRef.current = result
    setMatchResult(result)
  }, [])

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
    if (!email || !firstName || !lastName) return

    setIsCheckingMatch(true)
    isCheckingMatchRef.current = true
    setMatchNotice(null)
    updateMatchResult(null)

    const requestId = ++matchRequestIdRef.current

    try {
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

      const result: MatchResult = await response.json()

      if (requestId !== matchRequestIdRef.current) return

      if (!response.ok) throw new Error((result as { error?: string }).error || 'Failed to check verification match')

      updateMatchResult(result)
    } catch {
      // Non-blocking: sign-up can proceed without the pre-check.
      setMatchNotice(
        "We couldn't verify your details against our records. You can still sign up — verification can be completed after registration."
      )
    } finally {
      // Only the latest request may clear the checking state.
      if (matchRequestIdRef.current === requestId) {
        setIsCheckingMatch(false)
        isCheckingMatchRef.current = false
      }
    }
  }, [email, firstName, lastName, middleName, phone, address, barangay, dateOfBirth, nationalId, updateMatchResult])

  // Run the pre-registration check once the user reaches the final step, where
  // every field the matcher needs has been collected.
  useEffect(() => {
    if (step !== 3) return
    void checkVerificationMatch()
  }, [step, checkVerificationMatch])


  const focusFirstError = useCallback((errors: FieldErrors) => {
    const firstKey = STEP_FIELDS[1].concat(STEP_FIELDS[2], STEP_FIELDS[3]).find((key) => errors[key])
    if (!firstKey) return
    const el = document.getElementById(FIELD_IDS[firstKey])
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus({ preventScroll: true })
  }, [])

  const validateCurrentStep = useCallback((): boolean => {
    const errors =
      step === 1 ? validateStep1(values) : step === 2 ? validateStep2(values) : validateStep3(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors)
      return false
    }
    return true
  }, [step, values, focusFirstError])

  const goToStep = useCallback((next: Step) => {
    setFieldErrors({})
    setError(null)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCurrentStep()) return
    goToStep(step === 1 ? 2 : 3)
  }

  const handleBack = () => {
    goToStep(step === 3 ? 2 : 1)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    // Re-validate every step so a user cannot reach submit with stale errors.
    const allErrors = { ...validateStep1(values), ...validateStep2(values), ...validateStep3(values) }
    setFieldErrors(allErrors)
    if (Object.keys(allErrors).length > 0) {
      focusFirstError(allErrors)
      return
    }

    setIsLoading(true)
    setError(null)

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

      // Never misroute verification: if the pre-check is still running, wait for it.
      let action = matchResultRef.current?.action
      if (!action && isCheckingMatchRef.current) {
        const deadline = Date.now() + 5000
        while (!matchResultRef.current && isCheckingMatchRef.current && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
        action = matchResultRef.current?.action
      }
      formData.append('verificationAction', action || 'no_match')

      const result = await requestSignUpOtp(formData)

      if (result && 'error' in result) {
        const raw = result.error || 'An error occurred during sign-up'
        if (/rate.?limit|too many/i.test(raw)) {
          setRateLimitCountdown(30)
          setError('Too many attempts. Please wait a moment before trying again.')
        } else {
          setError(friendlySignUpError(raw))
        }
        setIsLoading(false)
        return
      }
      // On success the server action redirects to the OTP screen; keep the
      // button disabled so the form cannot be resubmitted mid-navigation.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during sign-up'
      setError(friendlySignUpError(message))
      setIsLoading(false)
    }
  }

  const passwordsMatch = repeatPassword.length > 0 && password === repeatPassword

  const renderMatchStatus = () => {
    if (isCheckingMatch) {
      return (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>Checking your details against our records...</span>
        </div>
      )
    }

    if (matchNotice) {
      return (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 dark:border-border dark:bg-muted dark:text-gray-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{matchNotice}</span>
        </div>
      )
    }

    if (!matchResult) return null

    if (matchResult.action === 'auto_verify') {
      return (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Your details match our records — your account will be verified automatically.</span>
        </div>
      )
    }

    if (matchResult.action === 'no_match') {
      return (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 dark:border-border dark:bg-muted dark:text-gray-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            We couldn&apos;t find your details in our records. You can still sign up — you may need to upload a valid ID
            for verification after registration.
          </span>
        </div>
      )
    }

    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          We found a possible match, but your account will need a quick review. You may be asked to upload a valid ID
          after registration.
        </span>
      </div>
    )
  }


  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#0D1B5E]">
      <div className="w-full max-w-170">
        <div className="bg-white dark:bg-card border border-transparent dark:border-border rounded-[12px] shadow-2xl overflow-hidden">
          <div className="p-8 md:p-10">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-muted-foreground dark:hover:text-card-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>

            {/* Logo Section */}
            <div className="mb-6 text-center">
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
                Create your account
              </h1>
              <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">{STEP_TITLES[step - 1]}</p>
            </div>

            {/* Step progress */}
            <div className="mb-8" aria-label={`Step ${step} of 3`}>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-muted-foreground">
                <span>
                  Step {step} of 3: {STEP_TITLES[step - 1]}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= step ? 'bg-[#228039]' : 'bg-gray-200 dark:bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            <form onSubmit={step === 3 ? handleSignUp : handleContinue} noValidate>
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* First Name */}
                    <div className="space-y-2">
                      <Label htmlFor="first-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        First Name
                      </Label>
                      <Input
                        id="first-name"
                        type="text"
                        placeholder="Juan"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        aria-invalid={!!fieldErrors.firstName}
                        aria-describedby={fieldErrors.firstName ? 'first-name-error' : undefined}
                        className={inputClassName(!!fieldErrors.firstName)}
                      />
                      <FieldError id="first-name" message={fieldErrors.firstName} />
                    </div>

                    {/* Last Name */}
                    <div className="space-y-2">
                      <Label htmlFor="last-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Last Name
                      </Label>
                      <Input
                        id="last-name"
                        type="text"
                        placeholder="Dela Cruz"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        aria-invalid={!!fieldErrors.lastName}
                        aria-describedby={fieldErrors.lastName ? 'last-name-error' : undefined}
                        className={inputClassName(!!fieldErrors.lastName)}
                      />
                      <FieldError id="last-name" message={fieldErrors.lastName} />
                    </div>

                    {/* Middle Name */}
                    <div className="space-y-2">
                      <Label htmlFor="middle-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Middle Name <span className="font-normal text-gray-400">(Optional)</span>
                      </Label>
                      <Input
                        id="middle-name"
                        type="text"
                        placeholder="Santos"
                        autoComplete="additional-name"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        className={inputClassName()}
                      />
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-2">
                      <Label htmlFor="date-of-birth" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date of Birth
                      </Label>
                      <Input
                        id="date-of-birth"
                        type="date"
                        max={TODAY}
                        autoComplete="bday"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        aria-invalid={!!fieldErrors.dateOfBirth}
                        aria-describedby={fieldErrors.dateOfBirth ? 'date-of-birth-error' : undefined}
                        className={inputClassName(!!fieldErrors.dateOfBirth)}
                      />
                      <FieldError id="date-of-birth" message={fieldErrors.dateOfBirth} />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="juan@example.com"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                      className={inputClassName(!!fieldErrors.email)}
                    />
                    <FieldError id="email" message={fieldErrors.email} />
                    <p className="text-xs text-gray-500 dark:text-muted-foreground">
                      We&apos;ll send a 6-digit code to this address to confirm it.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  {/* Barangay */}
                  <div className="space-y-2">
                    <Label htmlFor="barangay" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Barangay
                    </Label>
                    <Select value={barangay || undefined} onValueChange={setBarangay}>
                      <SelectTrigger
                        id="barangay"
                        aria-invalid={!!fieldErrors.barangay}
                        aria-describedby={fieldErrors.barangay ? 'barangay-error' : undefined}
                        className={inputClassName(!!fieldErrors.barangay)}
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
                    <FieldError id="barangay" message={fieldErrors.barangay} />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Phone Number <span className="font-normal text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="09XX XXX XXXX"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      aria-invalid={!!fieldErrors.phone}
                      aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                      className={inputClassName(!!fieldErrors.phone)}
                    />
                    <FieldError id="phone" message={fieldErrors.phone} />
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Complete Address <span className="font-normal text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      id="address"
                      type="text"
                      placeholder="Purok, Street, Block/Lot number"
                      autoComplete="street-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={inputClassName()}
                    />
                  </div>

                  {/* National ID */}
                  <div className="space-y-2">
                    <Label htmlFor="national-id" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      National ID <span className="font-normal text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      id="national-id"
                      type="text"
                      placeholder="12-digit PhilSys number"
                      inputMode="numeric"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      className={inputClassName()}
                    />
                    <p className="text-xs text-gray-500 dark:text-muted-foreground">
                      Providing your ID helps verify you faster against pre-registered records.
                    </p>
                  </div>

                  {/* ID Type */}
                  <div className="space-y-2">
                    <Label htmlFor="id-type" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      ID Type
                    </Label>
                    <Select value={idType} onValueChange={setIdType}>
                      <SelectTrigger id="id-type" className={inputClassName()}>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="philsys">PhilSys (Philhealth ID)</SelectItem>
                        <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
                        <SelectItem value="voter">Voter&apos;s ID</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="umid">UMID</SelectItem>
                        <SelectItem value="sss">SSS ID</SelectItem>
                        <SelectItem value="tin">TIN ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4">
                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password
                    </Label>
                    <PasswordInput
                      id="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      className={inputClassName(!!fieldErrors.password)}
                    />
                    <FieldError id="password" message={fieldErrors.password} />
                    {!fieldErrors.password && (
                      <p className="text-xs text-gray-500 dark:text-muted-foreground">Must be at least 6 characters.</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="repeat-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Confirm Password
                    </Label>
                    <PasswordInput
                      id="repeat-password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      aria-invalid={!!fieldErrors.repeatPassword}
                      aria-describedby={fieldErrors.repeatPassword ? 'repeat-password-error' : undefined}
                      className={inputClassName(!!fieldErrors.repeatPassword)}
                    />
                    <FieldError id="repeat-password" message={fieldErrors.repeatPassword} />
                    {passwordsMatch && !fieldErrors.repeatPassword && (
                      <p className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  {/* Verification match status */}
                  <div aria-live="polite">{renderMatchStatus()}</div>

                  {/* Consent */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="consent"
                        checked={consent}
                        onCheckedChange={(checked) => setConsent(checked === true)}
                        aria-invalid={!!fieldErrors.consent}
                        aria-describedby={fieldErrors.consent ? 'consent-error' : undefined}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="consent"
                          className="cursor-pointer text-sm font-normal leading-relaxed text-gray-700 dark:text-gray-300"
                        >
                          I consent to the collection and verification of my personal information — including my national
                          ID — for identity verification under the Data Privacy Act of 2012.
                        </Label>
                        <FieldError id="consent" message={fieldErrors.consent} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form-level error */}
              {error && (
                <div
                  role="alert"
                  className="mt-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-lg text-sm"
                >
                  {error}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="mt-8 flex gap-3">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isLoading}
                    className="h-11 flex-1 font-semibold"
                  >
                    Back
                  </Button>
                )}

                {step < 3 ? (
                  <Button
                    type="submit"
                    className="h-11 flex-1 bg-[#228039] hover:bg-[#1a642d] text-white font-semibold shadow-sm transition-colors"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
                    className="h-11 flex-1 bg-[#228039] hover:bg-[#1a642d] text-white font-semibold shadow-sm transition-colors"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending verification code...</span>
                      </span>
                    ) : rateLimitCountdown !== null && rateLimitCountdown > 0 ? (
                      `Try again in ${rateLimitCountdown}s`
                    ) : (
                      'Create account'
                    )}
                  </Button>
                )}
              </div>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-gray-500 dark:text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="font-medium text-[#228039] underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}







