import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRequest } from '@/lib/request-security'
import { getAdminFromRequest } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

const bucketName = 'announcement-images'

function buildSafeFileName(originalName: string) {
  const extensionMatch = originalName.match(/\.[a-z0-9]+$/i)
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '.png'
  const baseName = originalName
    .replace(extensionMatch?.[0] || '', '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  return `${crypto.randomUUID()}-${Date.now()}-${baseName || 'announcement'}${extension}`
}

async function ensureBucketExists() {
  const supabase = createAdminClient()

  const { data: bucketData, error: getBucketError } = await supabase.storage.getBucket(bucketName)
  if (!getBucketError && bucketData) {
    if (!bucketData.public) {
      logger.info('Bucket exists but not public, updating...', { context: 'api/announcement-images' })
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880,
      })
      if (updateError) {
        logger.error('Failed to update bucket to public', updateError, { context: 'api/announcement-images' })
        throw updateError
      }
    }
    return supabase
  }

  logger.info('Creating announcement-images bucket', { context: 'api/announcement-images' })
  const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    fileSizeLimit: 5242880,
  })

  if (createBucketError) {
    logger.error('Failed to create bucket', createBucketError, { context: 'api/announcement-images' })
    throw createBucketError
  }

  logger.info('Bucket created successfully', { context: 'api/announcement-images' })
  return supabase
}

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getAdminFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file was provided.' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PNG, JPG, and WEBP are allowed.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB.' }, { status: 400 })
    }

    const adminClient = await ensureBucketExists()
    const fileName = `announcements/${buildSafeFileName(file.name)}`
    const arrayBuffer = await file.arrayBuffer()
    const uploadFile = Buffer.from(arrayBuffer)

    logger.info('Uploading file to announcement-images bucket', { context: 'api/announcement-images', fileName, fileType: file.type, fileSize: file.size })

    const { error: uploadError } = await adminClient.storage.from(bucketName).upload(fileName, uploadFile, {
      contentType: file.type || 'image/png',
      upsert: true,
    })

    if (uploadError) {
      logger.error('Upload error', uploadError, { context: 'api/announcement-images' })
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data } = adminClient.storage.from(bucketName).getPublicUrl(fileName)
    logger.info('Generated public URL', { context: 'api/announcement-images', url: data.publicUrl })

    return NextResponse.json({ url: data.publicUrl, path: fileName })
  } catch (error: any) {
    logger.error('Error in announcement-images upload', error, { context: 'api/announcement-images' })
    const message = error instanceof Error ? error.message : 'Failed to upload image.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}