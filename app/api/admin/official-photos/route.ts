import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bucketName = 'official-photos'

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
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, '-')}`
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