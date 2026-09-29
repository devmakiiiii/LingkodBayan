// Postgres-backed OCR job store.
//
// This used to be a process-local Map on `globalThis`, which works in `next dev`
// but breaks in production: on a multi-instance deploy the /status poll can land
// on an instance that never saw the upload, so `getOcrJob` returns undefined and
// the resident's verification fails even though OCR succeeded. Jobs now live in
// `verification_ocr_jobs` (migration 35) so any instance can read them.
//
// The exported API is unchanged (`getOcrJob` / `setOcrJob`), but both functions
// are now async — callers already await the result of the route handler, so the
// only change at each call site is adding `await`.

import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

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

const TABLE = 'verification_ocr_jobs'

/**
 * `getOcrJob` is best-effort: a status poll must never 500 because the job
 * store had a transient problem, so lookup failures are logged and reported as
 * "no job yet" (the route turns that into a 404 and the client keeps polling).
 */
export async function getOcrJob(id: string, userId?: string): Promise<OcrJob | undefined> {
  const supabase = createAdminClient()

  const query = supabase
    .from(TABLE)
    .select('status, result, error')
    .eq('id', id)
    // Scope to the owner so a job id cannot be probed by another resident.
    .eq('user_id', userId ?? '')

  const { data, error } = await query.maybeSingle()

  if (error) {
    logger.warn('getOcrJob failed', { context: 'lib/verification-jobs', jobId: id }, error)
    return undefined
  }
  if (!data) return undefined

  return {
    status: data.status as OcrJobStatus,
    result: (data.result as OcrJob['result']) ?? undefined,
    error: data.error ?? undefined,
  }
}

export async function setOcrJob(
  id: string,
  userId: string,
  job: OcrJob,
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from(TABLE).upsert(
    {
      id,
      user_id: userId,
      status: job.status,
      result: job.result ?? null,
      error: job.error ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    // A failure to persist must be loud: silently losing the result is exactly
    // the bug this store exists to fix.
    logger.error('setOcrJob failed', error, { context: 'lib/verification-jobs', jobId: id })
  }
}
