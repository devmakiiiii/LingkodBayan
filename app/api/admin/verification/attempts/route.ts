import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  getVerificationAttempts,
  getVerificationAttemptById,
  updateVerificationAttempt,
  updateResidentVerification,
} from '@/lib/db'
import { notifyResidentByUserId } from '@/lib/notify'
import { verifyRequest } from '@/lib/request-security'
import { logAuditAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'
import { isAdminUser } from '@/lib/roles'

export async function GET(request: NextRequest) {
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

  // `!user` is checked explicitly so the rest of the handler is narrowed to a
  // signed-in user; isAdminUser alone cannot narrow the type.
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined

    const attempts = await getVerificationAttempts({
      status: status || undefined,
      limit,
    })

    return NextResponse.json({ attempts })
  } catch (error: unknown) {
    logger.error('[admin/verification/attempts] Error', error, { context: 'api/admin/verification/attempts' })
    const message = error instanceof Error ? error.message : 'Failed to fetch verification attempts.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
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

  // `!user` is checked explicitly so the rest of the handler is narrowed to a
  // signed-in user; isAdminUser alone cannot narrow the type.
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { attemptId, status, residentId, verificationStatus, verificationMethod, verificationConfidence, notes, rejectionReason } = body

    if (!attemptId) {
      return NextResponse.json({ error: 'attemptId is required.' }, { status: 400 })
    }

    const attempt = await getVerificationAttemptById(attemptId)

    if (!attempt) {
      return NextResponse.json({ error: 'Verification attempt not found.' }, { status: 404 })
    }

    // Require a structured reason on rejection so the resident is told what
    // to fix instead of guessing on resubmission.
    if (status === 'rejected' && !rejectionReason) {
      return NextResponse.json(
        { error: 'A rejection reason is required when rejecting a verification.' },
        { status: 400 },
      )
    }

    // Update the attempt record
    await updateVerificationAttempt(attemptId, {
      status: status || attempt.status,
      reviewedBy: user.id,
    })

    // Update the resident's verification status if provided
    if (residentId && verificationStatus) {
      const details = {
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(notes ? { adminNotes: notes } : {}),
        ...attempt.verification_details,
      }
      await updateResidentVerification(residentId, {
        verificationStatus,
        verificationMethod: verificationMethod || 'manual',
        verificationConfidence: verificationConfidence !== undefined ? verificationConfidence : undefined,
        verificationDetails: details,
        verifiedAt: verificationStatus === 'auto_verified' || verificationStatus === 'id_verified'
          ? new Date().toISOString()
          : undefined,
        verifiedBy: user.id,
      })
    }

    // In-app notification so the resident doesn't have to poll the page.
    if (attempt.residents?.user_id) {
      try {
        if (verificationStatus === 'auto_verified' || verificationStatus === 'id_verified') {
          await notifyResidentByUserId(attempt.residents.user_id, {
            type: 'verification_approved',
            title: 'Identity verification approved',
            body: 'Your ID has been verified. You now have full access to barangay services.',
            link: '/citizen/verify-id',
          })
        } else if (verificationStatus === 'rejected') {
          await notifyResidentByUserId(attempt.residents.user_id, {
            type: 'verification_rejected',
            title: 'Identity verification rejected',
            body: `${rejectionReason ?? 'Your ID submission was rejected.'}${notes ? ` — ${notes}` : ''} You can upload a clearer ID or message the reviewer from the verification page.`,
            link: '/citizen/verify-id',
          })
        }
      } catch (notifyError) {
        // A failed notification must never fail the admin's decision itself.
        logger.warn('[admin/verification/attempts] Failed to create user notification', { context: 'api/admin/verification/attempts' }, notifyError)
      }
    }

    await logAuditAction({
      adminId: user.id,
      adminEmail: user.email ?? undefined,
      action: 'verification_reviewed',
      resourceType: 'verification_attempt',
      resourceId: attemptId,
      oldValues: { status: attempt.status },
      newValues: {
        status: status || attempt.status,
        ...(verificationStatus ? { verificationStatus } : {}),
        ...(notes ? { notes } : {}),
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({
      success: true,
      attempt: {
        ...attempt,
        status: status || attempt.status,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error('[admin/verification/attempts] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update verification attempt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
