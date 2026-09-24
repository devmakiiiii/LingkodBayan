import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificationMatchSchema, type VerificationMatchInput } from '@/lib/schemas'
import {
  calculateMatchScore,
  determineAction,
  normalizeString,
  type SignUpVerificationInput,
  type PreRegisteredResident,
  type MatchResult,
} from '@/lib/verification'
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

    const candidates = await findCandidateResidents(supabase, input)

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

async function findCandidateResidents(
  supabase: ReturnType<typeof createAdminClient>,
  input: SignUpVerificationInput,
) {
  const orFilters: string[] = []

  if (input.email) {
    orFilters.push(`email.eq.${input.email.trim().toLowerCase()}`)
  }
  if (input.phone) {
    const cleanPhone = input.phone.replace(/\D/g, '')
    if (cleanPhone) {
      orFilters.push(`phone.like.*${cleanPhone}*`)
    }
  }
  if (input.nationalId) {
    const cleanId = input.nationalId.replace(/\D/g, '')
    if (cleanId) {
      orFilters.push(`national_id.like.*${cleanId}*`)
    }
  }

  if (orFilters.length > 0) {
    const orClause = orFilters.join(',')
    const { data, error } = await supabase
      .from('pre_registered_residents')
      .select('*')
      .or(orClause)
      .limit(50)

    if (error) {
      logger.error('[verification/match] Supabase error', error, { context: 'api/verification/match' })
      return []
    }
    return data || []
  }

  const firstNameNorm = normalizeString(input.firstName)
  const lastNameNorm = normalizeString(input.lastName)

  if (firstNameNorm && lastNameNorm) {
    const { data, error } = await supabase
      .from('pre_registered_residents')
      .select('*')
      .ilike('first_name', `${firstNameNorm}%`)
      .ilike('last_name', `${lastNameNorm}%`)
      .limit(50)

    if (error) {
      logger.error('[verification/match] Supabase error', error, { context: 'api/verification/match' })
      return []
    }
    return data || []
  }

  return []
}
