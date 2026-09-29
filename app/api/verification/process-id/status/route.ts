import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getOcrJob } from '@/lib/verification-jobs'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  // The job store is keyed by (id, user_id), so the caller must be authenticated
  // and a job id from another resident must not resolve.
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

  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter.' }, { status: 400 })
  }

  const job = await getOcrJob(jobId, user.id)

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }

  if (job.status === 'failed') {
    logger.warn('OCR job failed', { context: 'api/verification/process-id/status', jobId, error: job.error })
    return NextResponse.json({ error: job.error || 'Processing failed.' }, { status: 500 })
  }

  if (job.status === 'completed') {
    // `status` must be included: the verify-id page polls for
    // `statusData.status === 'completed'` before reading `result`.
    return NextResponse.json({ status: 'completed', result: job.result })
  }

  return NextResponse.json({ status: job.status })
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
