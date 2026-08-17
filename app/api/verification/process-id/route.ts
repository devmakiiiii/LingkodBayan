import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  parseOcrExtractedFields,
  calculateMatchScore,
  determineAction,
  type SignUpVerificationInput,
  type PreRegisteredResident,
} from '@/lib/verification'
import { getResidentVerification, updateResidentVerification, logVerificationAttempt, searchPreRegisteredResidents } from '@/lib/db'
import { getOcrJob, setOcrJob } from '@/lib/verification-jobs'
import { processIdVerificationSchema } from '@/lib/schemas'
import { verifyRequest } from '@/lib/request-security'
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

  try {
    const body = await request.json()
    const validated = processIdVerificationSchema.parse(body)

    const jobId = crypto.randomUUID()
    ocrJobs.setOcrJob(jobId, { status: 'processing' })

    setImmediate(async () => {
      try {
        const result = await processOcrJob(user.id, validated.signedUrl, validated.idType, validated.expectedValues)
        if (result) {
          ocrJobs.setOcrJob(jobId, { status: 'completed', result })
        } else {
          ocrJobs.setOcrJob(jobId, { status: 'failed', error: 'OCR processing failed.' })
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to process ID verification.'
        ocrJobs.setOcrJob(jobId, { status: 'failed', error: message })
      }
    })

    return NextResponse.json({ jobId, status: 'processing' }, { status: 202 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process ID verification.'
    logger.error('Error in POST /api/verification/process-id', error, { context: 'api/verification' })
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: message }, { status: 400 })
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

  if (!ocrResult) {
    return null
  }

  const { text: ocrText, confidence } = ocrResult

  const extractedFields = parseOcrExtractedFields(ocrText, idType)

  const resident = await getResidentVerification(userId)

  if (!resident) {
    return null
  }

  let matchedCandidate: PreRegisteredResident | null = null

  if (expectedValues.nationalId) {
    const candidates = await searchPreRegisteredResidents({
      nationalId: expectedValues.nationalId,
    })
    if (candidates.length > 0) {
      matchedCandidate = candidates[0] as unknown as PreRegisteredResident
    }
  } else if (expectedValues.email) {
    const candidates = await searchPreRegisteredResidents({
      email: expectedValues.email,
    })
    if (candidates.length > 0) {
      matchedCandidate = candidates[0] as unknown as PreRegisteredResident
    }
  }

  let matchScore = 0
  let breakdown: Record<string, number> = {}
  let action: 'auto_verify' | 'id_verify' | 'needs_review' | 'no_match' = 'no_match'

  if (matchedCandidate) {
    const input: SignUpVerificationInput = {
      firstName: extractedFields.firstName || expectedValues.firstName,
      lastName: extractedFields.lastName || expectedValues.lastName,
      middleName: extractedFields.middleName || expectedValues.middleName,
      email: extractedFields.email || expectedValues.email,
      phone: extractedFields.phone || expectedValues.phone,
      address: extractedFields.address || expectedValues.address,
      barangay: expectedValues.barangay,
      dateOfBirth: extractedFields.dateOfBirth || expectedValues.dateOfBirth,
      nationalId: extractedFields.nationalId || expectedValues.nationalId,
    }

    const result = calculateMatchScore(input, matchedCandidate)
    matchScore = result.score
    breakdown = result.breakdown
    action = determineAction(matchScore)
  } else {
    matchScore = 0
    breakdown = {}
    action = 'no_match'
  }

  try {
    await logVerificationAttempt({
      residentId: resident.id,
      attemptType: 'id_ocr',
      inputData: expectedValues,
      matchedPreRegisteredId: matchedCandidate?.id,
      matchScore,
      confidenceBreakdown: breakdown,
      ocrExtractedData: {
        ...extractedFields,
        ocrConfidence: confidence,
        ocrText: ocrText.substring(0, 2000),
      },
      status: action === 'auto_verify' || action === 'id_verify' ? 'matched' : 'needs_review',
    })
  } catch (logError) {
    console.error('[verification/process-id] Failed to log attempt:', logError)
  }

  let verificationStatus: string
  let verificationMethod = 'id_ocr'

  if (action === 'auto_verify') {
    verificationStatus = 'auto_verified'
  } else if (action === 'id_verify') {
    verificationStatus = 'id_verified'
  } else {
    verificationStatus = 'needs_review'
  }

  try {
    await updateResidentVerification(resident.id, {
      verificationStatus,
      verificationMethod,
      verificationConfidence: matchScore,
      verificationDetails: {
        matchScore,
        confidenceBreakdown: breakdown,
        ocrExtractedFields: extractedFields,
        ocrConfidence: confidence,
        idType,
      },
      idDocumentType: idType,
      verifiedAt: action === 'auto_verify' || action === 'id_verify' ? new Date().toISOString() : undefined,
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
  }
}

async function runOcr(signedUrl: string): Promise<{ text: string; confidence: number } | null> {
  if (process.env.GOOGLE_VISION_API_KEY) {
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
      }
    } catch (err) {
      console.error('[verification/process-id] Google Vision error:', err)
    }
  }

  try {
    const { createWorker } = await import('tesseract.js')
    const worker: any = await createWorker()
    await worker.load()
    await worker.loadLanguage('eng')
    await worker.initialize('eng')

    const recognizePromise = worker.recognize(signedUrl)
    const recognizeTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract.js recognition timed out')), 30000)
    )

    const result: any = await Promise.race([recognizePromise, recognizeTimeoutPromise])

    await worker.terminate()

    return {
      text: result.data?.text || result.data?.ocr?.text || '',
      confidence: result.data?.confidence || 0,
    }
  } catch (err) {
    console.error('[verification/process-id] Tesseract error:', err)
    return null
  }
}
