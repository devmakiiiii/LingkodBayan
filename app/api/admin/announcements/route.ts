import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

function generateExcerpt(content: string, maxLength = 200): string {
  const stripped = content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength) + '...'
}

export async function GET(request: NextRequest) {
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

  // Use admin client to bypass RLS and fetch all announcements
  const adminClient = createAdminClient()

// Try to select with image_url and excerpt first, fall back to without if column doesn't exist
   let { data, error }: { data: any[] | null; error: any } = await adminClient
     .from('announcements')
     .select('id, title, content, category, created_at, is_published, image_url, excerpt')
     .order('created_at', { ascending: false })

   // If image_url or excerpt column doesn't exist, retry without them
   if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
     console.warn('Optional columns not found, falling back to query without them')
     const result = await adminClient
       .from('announcements')
       .select('id, title, content, category, created_at, is_published')
       .order('created_at', { ascending: false })
     data = result.data as any[]
     error = result.error
   }

   if (error) {
     console.error('Error fetching announcements:', error)
     return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
   }

   // Add image_url and excerpt fields to each announcement if missing (for schema compatibility)
   const announcements = (data || []).map((announcement: any) => ({
     ...announcement,
     image_url: announcement.image_url || null,
     excerpt: announcement.excerpt || null,
   }))

  return NextResponse.json({ announcements })
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
    const body = await request.json()
    const { title, content, category, is_published, image_url, excerpt } = body

    if (!title || !content || !category) {
      return NextResponse.json({ error: 'Title, content, and category are required.' }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Build insert data with optional fields
    const insertData: any = {
      title,
      content,
      category,
      is_published: is_published ?? false,
    }

    // Auto-generate excerpt if not provided
    const finalExcerpt = excerpt || generateExcerpt(content)

    // Try with all optional fields, fall back if any column doesn't exist
    let { data, error }: { data: any[] | null; error: any } = await adminClient
      .from('announcements')
      .insert({ ...insertData, image_url: image_url || null, excerpt: finalExcerpt })
      .select()

    if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
      console.warn('Optional columns not found, inserting without them')
      const result = await adminClient
        .from('announcements')
        .insert(insertData)
        .select()

      // Add image_url and excerpt from request if missing (for schema compatibility)
      if (result.data) {
        result.data = result.data.map((a: any) => ({
          ...a,
          image_url: image_url || null,
          excerpt: finalExcerpt,
        }))
      }
      data = result.data as any[]
      error = result.error
    }

    if (error) {
      console.error('Error creating announcement:', error)
      return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
    }

    return NextResponse.json({ announcement: data?.[0] || null })
  } catch (error: any) {
    console.error('Error in POST /api/admin/announcements:', error)
    return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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
    const { id, title, content, category, is_published, image_url, excerpt } = body

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID is required.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const updateFields: any = {
      title,
      content,
      category,
      is_published,
    }
    
    // Auto-generate excerpt if not provided
    const finalExcerpt = excerpt || (content ? generateExcerpt(content) : null)
    
    // Try with optional fields, fall back if columns don't exist
    let { data, error }: { data: any[] | null; error: any } = await adminClient
      .from('announcements')
      .update({ ...updateFields, image_url, excerpt: finalExcerpt })
      .eq('id', id)
      .select()

    if (error && (error.message?.includes('image_url') || error.message?.includes('excerpt'))) {
      console.warn('Optional columns not found, updating without them')
      const result = await adminClient
        .from('announcements')
        .update(updateFields)
        .eq('id', id)
        .select()

      // Add image_url and excerpt from request if missing (for schema compatibility)
      if (result.data) {
        result.data = result.data.map((a: any) => ({
          ...a,
          image_url: image_url || null,
          excerpt: finalExcerpt,
        }))
      }
      data = result.data as any[]
      error = result.error
    }

    if (error) {
      console.error('Error updating announcement:', error)
      return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
    }

    return NextResponse.json({ announcement: data?.[0] || null })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/announcements:', error)
    return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID is required.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting announcement:', error)
      return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/announcements:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
  }
}