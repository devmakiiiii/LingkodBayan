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
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
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
