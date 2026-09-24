import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  getResidentVerification,
  updateResidentVerification,
  logVerificationAttempt,
} from '@/lib/db'
import { verificationAppealSchema } from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

/**
 * Appeal a rejected identity verification.
 *
 * The hybrid verification flow automates the first pass (form matching + OCR),
 * but a rejected resident needs a path to a human: re-running the same
 * automated pipeline would just fail again. This endpoint flips the resident
 * back to `needs_review` and logs a `manual_review` attempt so the case lands
 * in the admin review queue (`/admin/verification`) for an admin decision.
 */
export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const rateLimitResult = rateLimit({ interval: 60 * 60 * 1000, limit: 5 })(request)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many appeal requests. Please try again later.' },
      { status: 429 },
    )
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parseResult = verificationAppealSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      )
    }

    const resident = await getResidentVerification(user.id)

    if (!resident) {
      return NextResponse.json({ error: 'Resident profile not found.' }, { status: 404 })
    }

    if (resident.verification_status !== 'rejected') {
      return NextResponse.json(
        { error: 'Appeals are only available after a rejected verification.' },
        { status: 409 },
      )
    }

    const appealNote = parseResult.data.note?.trim()

    // Queue for human review. The appeal deliberately skips automated
    // re-matching so an administrator decides instead.
    await updateResidentVerification(resident.id, {
      verificationStatus: 'needs_review',
      verificationMethod: 'manual',
      verificationDetails: {
        ...(resident.verification_details ?? {}),
        appeal: {
          note: appealNote || null,
          requestedAt: new Date().toISOString(),
        },
      },
    })

    try {
      await logVerificationAttempt({
        residentId: resident.id,
        attemptType: 'manual_review',
        inputData: {
          appeal: true,
          ...(appealNote ? { note: appealNote } : {}),
          previousStatus: 'rejected',
          ...(resident.verification_confidence !== null &&
          resident.verification_confidence !== undefined
            ? { previousConfidence: resident.verification_confidence }
            : {}),
        },
        matchScore: resident.verification_confidence ?? undefined,
        status: 'needs_review',
      })
    } catch (logError) {
      // The resident status update above already queued the appeal; failure to
      // log the attempt should not fail the request, but must be visible.
      logger.error(
        '[verification/appeal] Failed to log appeal attempt',
        logError,
        { context: 'api/verification/appeal', residentId: resident.id },
      )
    }

    return NextResponse.json({
      success: true,
      verificationStatus: 'needs_review',
    })
  } catch (error: unknown) {
    logger.error('[verification/appeal] Error', error, { context: 'api/verification/appeal' })
    const message = error instanceof Error ? error.message : 'Failed to submit appeal.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
