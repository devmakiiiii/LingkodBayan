import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  parseOcrExtractedFields,
  calculateMatchScore,
  determineAction,
  type SignUpVerificationInput,
  type PreRegisteredResident,
  type MatchResult,
} from '@/lib/verification'
import { getResidentVerification, updateResidentVerification, logVerificationAttempt, searchPreRegisteredResidents } from '@/lib/db'

export async function POST(request: NextRequest) {
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
    const signedUrl: string = body.signedUrl
    const idType: string = body.idType || 'philsys'
    const expectedValues: {
      firstName: string
      lastName: string
      middleName?: string
      email: string
      phone?: string
      dateOfBirth?: string
      nationalId?: string
      barangay?: string
      address?: string
    } = body.expectedValues

    if (!signedUrl) {
      return NextResponse.json({ error: 'Missing signedUrl parameter.' }, { status: 400 })
    }

    // Run OCR
    const ocrResult = await runOcr(signedUrl)

    if (!ocrResult) {
      return NextResponse.json({ error: 'OCR processing failed.' }, { status: 500 })
    }

    const { text: ocrText, confidence } = ocrResult

    // Parse extracted fields from OCR
    const extractedFields = parseOcrExtractedFields(ocrText, idType)

    // Get the resident's current verification record
    const resident = await getResidentVerification(user.id)

    if (!resident) {
      return NextResponse.json({ error: 'Resident profile not found.' }, { status: 404 })
    }

    // Get the pre-registered resident to match against
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

    // Calculate match score
    let matchScore = 0
    let breakdown: Record<string, number> = {}
    let action: MatchResult['action'] = 'no_match'

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

    // Log the verification attempt
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

    // Update resident verification
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

    return NextResponse.json({
      extractedFields,
      ocrConfidence: confidence,
      matchScore,
      action,
      verificationStatus,
    })
  } catch (error: unknown) {
    console.error('[verification/process-id] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to process ID verification.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function runOcr(signedUrl: string): Promise<{ text: string; confidence: number } | null> {
  // Use Google Vision API if key is configured
  if (process.env.GOOGLE_VISION_API_KEY) {
    try {
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { source: { imageUri: signedUrl } },
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              },
            ],
          }),
        },
      )

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

  // Fall back to Tesseract.js
  try {
    const { createWorker } = await import('tesseract.js')
    const worker: any = await createWorker()
    await worker.load()
    await worker.loadLanguage('eng')
    await worker.initialize('eng')

    const result: any = await worker.recognize(signedUrl)

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
