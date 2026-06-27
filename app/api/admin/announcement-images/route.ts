import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'

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
    // Check if bucket is public, if not update it
    if (!bucketData.public) {
      console.log('[DEBUG] Bucket exists but not public, updating...')
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880,
      })
      if (updateError) {
        console.error('[DEBUG] Failed to update bucket to public:', updateError)
        throw updateError
      }
    }
    return supabase
  }

  console.log('[DEBUG] Creating announcement-images bucket...')
  const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    fileSizeLimit: 5242880,
  })

  if (createBucketError) {
    console.error('[DEBUG] Failed to create bucket:', createBucketError)
    throw createBucketError
  }

  console.log('[DEBUG] Bucket created successfully')
  return supabase
}

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

    console.log('[DEBUG] Uploading file to announcement-images bucket:', { fileName, fileType: file.type, fileSize: file.size })

    const { error: uploadError } = await adminClient.storage.from(bucketName).upload(fileName, uploadFile, {
      contentType: file.type || 'image/png',
      upsert: true,
    })

    if (uploadError) {
      console.error('[DEBUG] Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data } = adminClient.storage.from(bucketName).getPublicUrl(fileName)
    console.log('[DEBUG] Generated public URL:', data.publicUrl)

    return NextResponse.json({ url: data.publicUrl, path: fileName })
  } catch (error: any) {
    console.error('[DEBUG] Error in announcement-images upload:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload image.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}