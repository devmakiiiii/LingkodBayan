import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificationMatchSchema, type VerificationMatchInput } from '@/lib/schemas'
import {
  calculateMatchScore,
  determineAction,
  type SignUpVerificationInput,
  type PreRegisteredResident,
  type MatchResult,
} from '@/lib/verification'
import { findPreRegisteredCandidates } from '@/lib/db'
import { verifyRequest } from '@/lib/request-security'
import { durableRateLimit } from '@/lib/rate-limit-durable'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  // The match endpoint probes pre-registered resident data by email, phone,
  // and national ID before any account exists, so it is a data-enumeration
  // target. Same shape as the sign-up OTP limiter: durable (Postgres) so the
  // counter survives cold starts, keyed per client IP.
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const matchRateLimit = await durableRateLimit(`verification-match:${clientIp}`, {
    intervalMs: 10 * 60 * 1000,
    limit: 10,
  })
  if (!matchRateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please try again later.' },
      { status: 429 },
    )
  }

  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const parseResult = verificationMatchSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      )
    }

    const input: SignUpVerificationInput = parseResult.data as VerificationMatchInput

    // `pre_registered_residents` is admin-only under RLS, so the lookup needs
    // the service-role client (see findPreRegisteredCandidates).
    const candidates = await findPreRegisteredCandidates(
      {
        email: input.email,
        phone: input.phone,
        nationalId: input.nationalId,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      supabase,
    )

    if (candidates.length === 0) {
      return NextResponse.json({
        matched: false,
        confidence: 0,
        matchedResident: null,
        action: 'no_match',
        confidenceBreakdown: {},
      } satisfies MatchResult)
    }

    const scoredCandidates = candidates.map((candidate) => {
      const { score, breakdown } = calculateMatchScore(input, candidate as PreRegisteredResident)
      return { candidate: candidate as PreRegisteredResident, score, breakdown }
    })

    scoredCandidates.sort((a, b) => b.score - a.score)

    const bestMatch = scoredCandidates[0]
    const action = determineAction(bestMatch.score)

    return NextResponse.json({
      matched: action !== 'no_match',
      confidence: bestMatch.score,
      matchedResident:
        action !== 'no_match'
          ? {
              id: bestMatch.candidate.id,
              firstName: bestMatch.candidate.first_name,
              lastName: bestMatch.candidate.last_name,
              email: bestMatch.candidate.email,
              barangay: bestMatch.candidate.barangay,
            }
          : null,
      action,
      confidenceBreakdown: bestMatch.breakdown,
    } satisfies MatchResult)
  } catch (error: unknown) {
    logger.error('[verification/match] Error', error, { context: 'api/verification/match' })
    const message =
      error instanceof Error ? error.message : 'Failed to process verification match'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
