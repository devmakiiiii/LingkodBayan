import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getUserRole, isAdminRole, isAdminUser } from '@/lib/roles'

export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null, error: error?.message || 'Unauthorized' }
    }

    return { user, error: null }
  } catch (error) {
    logger.error('Authentication check failed', error, { context: 'auth' })
    return { user: null, error: 'Authentication failed' }
  }
}

export async function getAdminUser(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null, error: error?.message || 'Unauthorized' }
    }

    const role = getUserRole(user)

    if (!isAdminRole(role)) {
      return { user: null, error: 'Forbidden' }
    }

    return { user, error: null }
  } catch (error) {
    logger.error('Admin authentication check failed', error, { context: 'auth' })
    return { user: null, error: 'Authentication failed' }
  }
}

export async function getResidentId(request: NextRequest): Promise<{ residentId: string | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return { residentId: null, error: error?.message || 'Unauthorized' }
    }

    const { data: resident, error: residentError } = await supabase
      .from('residents')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (residentError || !resident) {
      return { residentId: null, error: 'Resident profile not found' }
    }

    return { residentId: resident.id, error: null }
  } catch (error) {
    logger.error('Failed to get resident ID', error, { context: 'auth' })
    return { residentId: null, error: 'Failed to get resident profile' }
  }
}

/** Role guard for server components. Only `app_metadata` is trusted. */
export function isAdmin(user: { app_metadata?: Record<string, unknown> | null } | null): boolean {
  return isAdminUser(user)
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}
