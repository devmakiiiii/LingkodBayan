import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getVerificationAttempts,
  getVerificationAttemptById,
  updateVerificationAttempt,
  updateResidentVerification,
} from '@/lib/db'

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

  const isAdmin = !!user && (
    user.user_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'super_admin' ||
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'super_admin'
  )

  if (!isAdmin) {
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
    console.error('[admin/verification/attempts] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch verification attempts.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

  const isAdmin = !!user && (
    user.user_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'super_admin' ||
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'super_admin'
  )

  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { attemptId, status, residentId, verificationStatus, verificationMethod, verificationConfidence, notes } = body

    if (!attemptId) {
      return NextResponse.json({ error: 'attemptId is required.' }, { status: 400 })
    }

    const attempt = await getVerificationAttemptById(attemptId)

    if (!attempt) {
      return NextResponse.json({ error: 'Verification attempt not found.' }, { status: 404 })
    }

    // Update the attempt record
    await updateVerificationAttempt(attemptId, {
      status: status || attempt.status,
      reviewedBy: user.id,
    })

    // Update the resident's verification status if provided
    if (residentId && verificationStatus) {
      await updateResidentVerification(residentId, {
        verificationStatus,
        verificationMethod: verificationMethod || 'manual',
        verificationConfidence: verificationConfidence !== undefined ? verificationConfidence : undefined,
        verificationDetails: notes ? { adminNotes: notes, ...attempt.verification_details } : attempt.verification_details,
        verifiedAt: verificationStatus === 'auto_verified' || verificationStatus === 'id_verified'
          ? new Date().toISOString()
          : undefined,
        verifiedBy: user.id,
      })
    }

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
