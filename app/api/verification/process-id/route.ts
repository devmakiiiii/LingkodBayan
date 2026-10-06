import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import {
  parseOcrExtractedFields,
  calculateMatchScore,
  calculateDocumentConsistencyScore,
  determineAction,
  mergeExtractedFields,
  type MatchResult,
  type SignUpVerificationInput,
} from '@/lib/verification'
import { getResidentVerification, updateResidentVerification, logVerificationAttempt, findPreRegisteredCandidates } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOcrJob, setOcrJob } from '@/lib/verification-jobs'
import { processIdVerificationSchema } from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
import { durableRateLimit } from '@/lib/rate-limit-durable'
import { logger } from '@/lib/logger'

const ocrJobs = { getOcrJob, setOcrJob }

export async function POST(request: NextRequest) {
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

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // OCR is the most expensive operation on the public surface (external
  // tesseract invocation per request). Durable limiter keyed per user so the
  // counter survives cold starts, mirroring the upload-id daily cap.
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ocrRateLimit = await durableRateLimit(`verification-ocr:${user.id}:${clientIp}`, {
    intervalMs: 10 * 60 * 1000,
    limit: 10,
  })
  if (!ocrRateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many ID verification attempts. Please try again later.' },
      { status: 429 },
    )
  }

  try {
    const body = await request.json()
    const validated = processIdVerificationSchema.parse(body)

    const jobId = crypto.randomUUID()
    // Awaited so the row exists before the client is told to poll for it —
    // otherwise the first poll can race the insert and 404.
    await ocrJobs.setOcrJob(jobId, user.id, { status: 'processing' })

    setImmediate(async () => {
      try {
        const result = await processOcrJob(user.id, validated.signedUrl, validated.idType, validated.expectedValues)
        if (result) {
          await ocrJobs.setOcrJob(jobId, user.id, { status: 'completed', result })
        } else {
          await ocrJobs.setOcrJob(jobId, user.id, { status: 'failed', error: 'OCR processing failed.' })
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to process ID verification.'
        await ocrJobs.setOcrJob(jobId, user.id, { status: 'failed', error: message })
      }
    })

    return NextResponse.json({ jobId, status: 'processing' }, { status: 202 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process ID verification.'
    logger.error('Error in POST /api/verification/process-id', error, { context: 'api/verification' })
    if (error instanceof Error && error.name === 'ZodError') {
      const issues = (error as Error & { issues?: { message: string }[] }).issues ?? []
      return NextResponse.json(
        { error: issues[0]?.message || 'Invalid verification request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function processOcrJob(
  userId: string,
  signedUrl: string,
  idType: string,
  expectedValues: {
    firstName: string
    lastName: string
    middleName?: string
    email: string
    phone?: string
    dateOfBirth?: string
    nationalId?: string
    barangay?: string
    address?: string
  },
) {
  const ocrResult = await runOcr(signedUrl)

  if (!ocrResult || !ocrResult.text.trim()) {
    // Fail loudly instead of falling through: without readable OCR text the
    // match below would score purely on expectedValues, "verifying" an ID
    // that was never actually read.
    throw new Error(
      'We could not read the text on your ID. Please upload a clearer, well-lit photo and try again.',
    )
  }

  const { text: ocrText, confidence } = ocrResult

  const extractedFields = parseOcrExtractedFields(ocrText, idType)

  const resident = await getResidentVerification(userId)

  if (!resident) {
    throw new Error('Your resident profile was not found. Please sign out and sign in again, then retry.')
  }

  // Values read off the ID take precedence over what the user typed, so the
  // registry comparison is driven by the document whenever it was legible.
  const input: SignUpVerificationInput = mergeExtractedFields(expectedValues, extractedFields)

  let matchScore = 0
  let breakdown: Record<string, number> = {}
  let comparedFields: string[] = []
  let registryMatched = false
  let matchedCandidateId: string | undefined
  let scoreSource: 'registry_match' | 'document_consistency' = 'document_consistency'
  let action: MatchResult['action'] = 'needs_review'

  try {
    // `pre_registered_residents` is admin-only under RLS: the resident-scoped
    // client returns zero rows *without* raising an error, which is why every
    // attempt used to be reported as a 0% match even when the ID genuinely
    // agreed with the account. Read the registry with the service-role client.
    const candidates = await findPreRegisteredCandidates(
      {
        nationalId: extractedFields.nationalId || expectedValues.nationalId,
        email: expectedValues.email,
        phone: expectedValues.phone,
      },
      createAdminClient(),
    )

    // Score every candidate and keep the best one rather than trusting the
    // first row the lookup happened to return.
    const best = candidates
      .map((candidate) => {
        const { score, breakdown: fieldBreakdown } = calculateMatchScore(input, candidate)
        return { candidate, score, breakdown: fieldBreakdown }
      })
      .sort((a, b) => b.score - a.score)[0]

    if (best) {
      matchedCandidateId = best.candidate.id
      matchScore = best.score
      breakdown = best.breakdown
      comparedFields = Object.keys(best.breakdown)
      registryMatched = true
      scoreSource = 'registry_match'
      action = determineAction(matchScore)
    }
  } catch (error) {
    // A missing service-role key or a transient database error must not fail
    // the resident's attempt: fall back to the document-consistency score and
    // let a human review the submission.
    console.error('[verification/process-id] Pre-registered resident lookup failed:', error)
  }

  let message: string

  if (registryMatched) {
    message =
      action === 'auto_verify' || action === 'id_verify'
        ? `Your ID matched our records (${Math.round(matchScore)}% confidence).`
        : `We read your ID but it only matched our records at ${Math.round(matchScore)}%. An officer will review it.`
  } else {
    // There is nothing in the registry to compare against, so report how
    // consistently the text read off the ID agrees with the account profile
    // instead of a misleading 0%. This can never auto-verify: the user supplied
    // both sides of the comparison, so a human must confirm the document.
    const consistency = calculateDocumentConsistencyScore(extractedFields, expectedValues)
    matchScore = consistency.score
    breakdown = consistency.breakdown
    comparedFields = consistency.comparedFields
    action = 'needs_review'
    message =
      consistency.evidenceStrength === 0
        ? 'We could not read enough fields from your ID to compare it with your account. Please upload a clearer, well-lit photo.'
        : `We read your ID and it matches your account details (${Math.round(consistency.score)}%), but we found no pre-registered record for you. An officer will verify your ID manually.`
  }

  try {
    await logVerificationAttempt({
      residentId: resident.id,
      attemptType: 'id_ocr',
      inputData: expectedValues,
      matchedPreRegisteredId: matchedCandidateId,
      matchScore,
      confidenceBreakdown: breakdown,
      ocrExtractedData: {
        ...extractedFields,
        ocrConfidence: confidence,
        ocrText: ocrText.substring(0, 2000),
        scoreSource,
        registryMatched,
        comparedFields,
      },
      status:
        registryMatched && (action === 'auto_verify' || action === 'id_verify')
          ? 'matched'
          : 'needs_review',
    })
  } catch (logError) {
    console.error('[verification/process-id] Failed to log attempt:', logError)
  }

  const verificationStatus =
    action === 'auto_verify' ? 'auto_verified' : action === 'id_verify' ? 'id_verified' : 'needs_review'

  try {
    await updateResidentVerification(resident.id, {
      verificationStatus,
      verificationMethod: 'id_ocr',
      verificationConfidence: matchScore,
      verificationDetails: {
        matchScore,
        confidenceBreakdown: breakdown,
        comparedFields,
        scoreSource,
        registryMatched,
        ocrExtractedFields: extractedFields,
        ocrConfidence: confidence,
        idType,
        message,
      },
      idDocumentType: idType,
      verifiedAt:
        verificationStatus === 'auto_verified' || verificationStatus === 'id_verified'
          ? new Date().toISOString()
          : undefined,
    })
  } catch (updateError) {
    console.error('[verification/process-id] Failed to update resident verification:', updateError)
  }

  return {
    extractedFields,
    ocrConfidence: confidence,
    matchScore,
    action,
    verificationStatus,
    scoreSource,
    registryMatched,
    comparedFields,
    message,
  }
}

function resolveTesseractWorkerPath(): string | null {
  // tesseract.js computes its default workerPath from `__dirname`, which can
  // be rewritten to a stale absolute path when this route is bundled (we
  // observed `C:\ROOT\...` leaking from an old build cache, which made the
  // worker fail to spawn and the OCR job hang until the client timed out).
  // Resolve the package's real location ourselves and pass it explicitly.
  const candidates: string[] = []
  try {
    candidates.push(createRequire(import.meta.url).resolve('tesseract.js/package.json'))
  } catch {
    // import.meta.url unavailable in some bundler outputs — try cwd below.
  }
  candidates.push(path.join(process.cwd(), 'node_modules', 'tesseract.js', 'package.json'))

  for (const pkgJson of candidates) {
    try {
      // realpathSync resolves the pnpm junction so the worker's own module
      // resolution finds sibling packages such as tesseract.js-core.
      const pkgDir = fs.realpathSync(path.dirname(pkgJson))
      const workerPath = path.join(pkgDir, 'src', 'worker-script', 'node', 'index.js')
      if (fs.existsSync(workerPath)) return workerPath
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

async function runOcr(signedUrl: string): Promise<{ text: string; confidence: number } | null> {
  if (process.env.GOOGLE_VISION_API_KEY) {
    let configError: string | null = null

    try {
      const visionPromise = fetch(
        'https://vision.googleapis.com/v1/images:annotate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GOOGLE_VISION_API_KEY,
          },
          body: JSON.stringify({
            requests: [
              {
                image: { source: { imageUri: signedUrl } },
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              },
            ],
          }),
        }
      )

      const visionTimeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Google Vision API timed out')), 15000)
      )

      const visionResponse = await Promise.race([visionPromise, visionTimeoutPromise])

      if (visionResponse.ok) {
        const visionData = await visionResponse.json()
        const textAnnotations = visionData.responses?.[0]?.textAnnotations
        if (textAnnotations && textAnnotations.length > 0) {
          return {
            text: textAnnotations[0].description || '',
            confidence: textAnnotations[0].confidence ? textAnnotations[0].confidence * 100 : 85,
          }
        }
      } else {
        const errorBody = await visionResponse.text().catch(() => '')
        configError = `HTTP ${visionResponse.status}: ${errorBody.slice(0, 300)}`
      }
    } catch (err) {
      configError = err instanceof Error ? err.message : String(err)
    }

    if (configError) {
      // Most commonly HTTP 403: the Cloud Vision API is not enabled for this
      // Google Cloud project. The tesseract.js fallback below keeps
      // verification working either way, but the cause is worth logging.
      console.error(
        '[verification/process-id] Google Vision unavailable, using tesseract.js fallback —',
        configError,
      )
    }
  }

  try {
    const { createWorker } = await import('tesseract.js')

    const workerPath = resolveTesseractWorkerPath()
    if (!workerPath) {
      console.error('[verification/process-id] tesseract.js worker script not found; OCR fallback unavailable')
      return null
    }

    // tesseract.js v7 fully initializes the worker (load + language data +
    // engine) inside createWorker(). That promise never settles when any
    // step fails — including spawning the worker from a bad `__dirname`
    // baked into a stale bundle — so race it against a hard timeout instead
    // of hanging the OCR job until the client gives up.
    const createWorkerPromise = createWorker('eng', undefined, {
      workerPath,
      errorHandler: (err: unknown) =>
        console.error('[verification/process-id] tesseract worker error:', err),
    })
    const startupTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract worker failed to start within 45 seconds')), 45000)
    )
    const worker = await Promise.race([createWorkerPromise, startupTimeoutPromise])

    try {
      const recognizePromise = worker.recognize(signedUrl)
      const recognizeTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tesseract.js recognition timed out')), 30000)
      )

      const result = await Promise.race([recognizePromise, recognizeTimeoutPromise])

      return {
        text: result.data?.text || '',
        confidence: result.data?.confidence || 0,
      }
    } finally {
      await worker.terminate().catch(() => {})
    }
  } catch (err) {
    console.error('[verification/process-id] Tesseract error:', err)
    return null
  }
}
