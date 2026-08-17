import { NextRequest, NextResponse } from 'next/server'
import { getOcrJob } from '@/lib/verification-jobs'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter.' }, { status: 400 })
  }

  const job = getOcrJob(jobId)

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }

  if (job.status === 'failed') {
    logger.warn('OCR job failed', { context: 'api/verification/process-id/status', jobId, error: job.error })
    return NextResponse.json({ error: job.error || 'Processing failed.' }, { status: 500 })
  }

  if (job.status === 'completed') {
    return NextResponse.json({ result: job.result })
  }

  return NextResponse.json({ status: job.status })
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
