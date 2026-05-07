import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    throw createBucketError
  }

  return supabase
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file was provided.' }, { status: 400 })
    }

    const supabase = await ensureBucketExists()
    const fileName = buildSafeFileName(file.name)
    const arrayBuffer = await file.arrayBuffer()
    const uploadFile = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, uploadFile, {
      contentType: file.type || 'image/png',
      upsert: true,
    })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName)

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload official photo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}