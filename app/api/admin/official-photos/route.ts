import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRequest } from '@/lib/request-security'
import { getAdminFromRequest } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

const bucketName = 'official-photos'

function buildSafeFileName(originalName: string) {
  const extensionMatch = originalName.match(/\.[a-z0-9]+$/i)
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : ''
  const baseName = originalName
    .replace(extensionMatch?.[0] || '', '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  return `${crypto.randomUUID()}-${baseName || 'official-photo'}${extension}`
}

async function ensureBucketExists() {
  const supabase = createAdminClient()

  const { error: getBucketError } = await supabase.storage.getBucket(bucketName)
  if (!getBucketError) {
    return supabase
  }

  const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
    public: true,
  })

  if (createBucketError) {
    logger.error('Failed to create bucket', createBucketError, { context: 'api/official-photos' })
    throw createBucketError
  }

  logger.info('Bucket created successfully', { context: 'api/official-photos' })
  return supabase
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  // Admin-only. Middleware guards page routes (`/admin/*`) but never `/api/*`,
  // and the upload below uses the service-role client, which bypasses storage
  // RLS. Without this role check any signed-in resident could push arbitrary
  // image files into the public `official-photos` bucket.
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file was provided.' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Only image files are allowed.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB.' }, { status: 400 })
    }

    const adminClient = await ensureBucketExists()
    const fileName = buildSafeFileName(file.name)
    const arrayBuffer = await file.arrayBuffer()
    const uploadFile = Buffer.from(arrayBuffer)

    const { error: uploadError } = await adminClient.storage.from(bucketName).upload(fileName, uploadFile, {
      contentType: file.type || 'image/png',
      upsert: true,
    })

    if (uploadError) {
      logger.error('Upload error', uploadError, { context: 'api/official-photos' })
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data } = adminClient.storage.from(bucketName).getPublicUrl(fileName)

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload official photo.'
    logger.error('Upload error', error, { context: 'api/official-photos' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Removes a photo object from the public bucket. Used when an official's photo
// is replaced or removed, and to roll back a failed save, so orphaned files do
// not accumulate in the bucket.
export async function DELETE(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  // Same gate as POST: middleware never covers /api/*, and the storage client
  // below uses the service role, which bypasses storage RLS.
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { path?: string }
    const path = typeof body.path === 'string' ? body.path.trim() : ''

    // Object names come from buildSafeFileName and never contain path
    // separators; reject anything else before handing it to the storage API.
    if (!path || path.includes('/') || path.includes('\\') || path.includes('..') || path.length > 200) {
      return NextResponse.json({ error: 'Invalid photo path.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.storage.from(bucketName).remove([path])

    if (error) {
      logger.error('Remove error', error, { context: 'api/official-photos' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ removed: path })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove official photo.'
    logger.error('Remove error', error, { context: 'api/official-photos' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}