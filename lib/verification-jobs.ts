// In-memory OCR job store.
// NOTE: For production, replace with a database-backed job queue (e.g., Supabase table + polling).
// The map is stored on globalThis so it is shared across route bundles (each
// route handler is bundled separately, so a module-level Map would not be
// visible to the status endpoint) and survives dev-server recompiles.

export type OcrJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface OcrJob {
  status: OcrJobStatus
  result?: {
    extractedFields: Record<string, string>
    ocrConfidence: number
    matchScore: number
    action: string
    verificationStatus: string
    // Which comparison produced `matchScore`: the admin-maintained registry
    // (`registry_match`) or the ID text vs. the resident's own account profile
    // (`document_consistency`).
    scoreSource?: 'registry_match' | 'document_consistency'
    registryMatched?: boolean
    comparedFields?: string[]
    message?: string
  }
  error?: string
}

type JobStoreGlobal = typeof globalThis & { __ocrJobStore?: Map<string, OcrJob> }

const globalScope = globalThis as JobStoreGlobal
const jobs: Map<string, OcrJob> = globalScope.__ocrJobStore ?? new Map<string, OcrJob>()
globalScope.__ocrJobStore = jobs

export function getOcrJob(id: string): OcrJob | undefined {
  return jobs.get(id)
}

export function setOcrJob(id: string, job: OcrJob): void {
  jobs.set(id, job)
}
