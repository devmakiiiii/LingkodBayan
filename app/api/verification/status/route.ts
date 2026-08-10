import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getResidentVerification } from '@/lib/db'

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

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const verification = await getResidentVerification(user.id)

    if (!verification) {
      return NextResponse.json({ error: 'Resident profile not found.' }, { status: 404 })
    }

    return NextResponse.json({
      verificationStatus: verification.verification_status,
      verificationMethod: verification.verification_method,
      verificationConfidence: verification.verification_confidence,
      verificationDetails: verification.verification_details,
      idDocumentType: verification.id_document_type,
      verifiedAt: verification.verified_at,
    })
  } catch (error: unknown) {
    console.error('[verification/status] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch verification status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
