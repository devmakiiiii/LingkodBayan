// In-memory OCR job store.
// NOTE: For production, replace with a database-backed job queue (e.g., Supabase table + polling).
// In-memory storage does not persist across serverless instances or process restarts.

export type OcrJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface OcrJob {
  status: OcrJobStatus
  result?: {
    extractedFields: Record<string, string>
    ocrConfidence: number
    matchScore: number
    action: string
    verificationStatus: string
  }
  error?: string
}

const jobs = new Map<string, OcrJob>()

export function getOcrJob(id: string): OcrJob | undefined {
  return jobs.get(id)
}

export function setOcrJob(id: string, job: OcrJob): void {
  jobs.set(id, job)
}
