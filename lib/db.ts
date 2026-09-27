import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PreRegisteredResident } from './verification'
import { RequestInput, ComplaintInput, DesignationInput, OfficialInput, BarangayInfoInput, MissionVisionInput, SignatureUploadInput, ServiceCategoryInput } from './schemas'
import { logger } from './logger'
import { isAnnouncementColumnError } from './announcements'
import { assertRequestTransition, assertComplaintTransition } from './status-machine'
import {
  buildRequestPaymentSnapshot,
  toRequestPaymentRow,
  validateRequestPayment,
  type RequestPaymentDraft,
  type RequestPaymentFeeInfo,
  type RequestPaymentSnapshot,
} from './request-payment'

export async function createResident(userData: {
  userId: string
  firstName: string
  lastName: string
  email: string
  barangay: string
  phone?: string | null
  address?: string | null
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.from('residents').insert([
    {
      user_id: userData.userId,
      first_name: userData.firstName,
      last_name: userData.lastName,
      email: userData.email,
      barangay: userData.barangay,
      phone: userData.phone || null,
      address: userData.address || null,
    },
  ]).select().single()

  if (error) throw new Error(`Failed to create resident: ${error.message}`)
  return data
}

export async function getResident(userId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('residents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Failed to get resident: ${error.message}`)
  return data?.[0] ?? null
}

export type RequestPaymentInput = {
  fee: RequestPaymentFeeInfo
  draft: RequestPaymentDraft
}

export async function createRequest(residentId: string, input: RequestInput, payment?: RequestPaymentInput) {
  const supabase = await createClient()

  let paymentSnapshot: RequestPaymentSnapshot | null = null
  if (payment) {
    const paymentValidationError = validateRequestPayment(payment.fee, payment.draft)
    if (paymentValidationError) throw new Error(paymentValidationError)
    paymentSnapshot = buildRequestPaymentSnapshot(payment.fee, payment.draft)
  }

  const { data, error } = await supabase.from('requests').insert([
    {
      resident_id: residentId,
      request_type: input.requestType,
      title: input.title,
      description: input.description,
      category: input.category,
      payload: paymentSnapshot ? { ...input.payload, payment: { ...paymentSnapshot } } : input.payload,
      status: 'pending',
      priority: 'normal',
    },
  ]).select().single()

  if (error) throw new Error(`Failed to create request: ${error.message}`)

  if (paymentSnapshot && data?.id) {
    const { error: paymentInsertError } = await supabase.from('request_payments').insert([
      {
        request_id: data.id,
        resident_id: residentId,
        ...toRequestPaymentRow(paymentSnapshot),
      },
    ])
    if (paymentInsertError) {
      throw new Error(`Failed to save request payment: ${paymentInsertError.message}`)
    }
  }

  return data
}

export async function getResidentRequests(residentId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('requests')
    .select('id, resident_id, request_type, title, description, category, payload, status, priority, created_at, updated_at')
    .eq('resident_id', residentId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get requests: ${error.message}`)
  return data || []
}

export async function createComplaint(residentId: string, input: ComplaintInput & { latitude?: number | null; longitude?: number | null; locationAddress?: string | null; evidenceUrl?: string | null }) {
   const supabase = await createClient()
   
   const complaintData: Record<string, any> = {
     resident_id: residentId,
     title: input.title,
     description: input.description,
     category: input.category,
     status: 'open',
     priority: 'normal',
   }

   // Add optional geolocation fields
   if (input.latitude) complaintData.latitude = input.latitude
   if (input.longitude) complaintData.longitude = input.longitude
   if (input.locationAddress) complaintData.location_address = input.locationAddress
   if (input.evidenceUrl) complaintData.evidence_url = input.evidenceUrl

   const { data, error } = await supabase.from('complaints').insert([complaintData]).select().single()

   if (error) throw new Error(`Failed to create complaint: ${error.message}`)
   return data
 }

export async function getResidentComplaints(residentId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('resident_id', residentId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get complaints: ${error.message}`)
  return data || []
}

/** Column sets from richest to leanest so older databases still work. */
const ANNOUNCEMENT_COLUMNS_FULL =
  'id, title, content, category, created_at, updated_at, published_at, expires_at, pinned, is_published, image_url, excerpt'
const ANNOUNCEMENT_COLUMNS_NO_PIN =
  'id, title, content, category, created_at, updated_at, published_at, is_published, image_url, excerpt'
const ANNOUNCEMENT_COLUMNS_BASE = 'id, title, content, category, created_at, updated_at, is_published'

/**
 * Runs each query variant until one succeeds, skipping variants whose columns
 * have not been added by the migrations yet.
 */
async function runUntilColumnSupport<T>(
  attempts: Array<() => PromiseLike<{ data: T; error: any }>>,
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null

  for (const attempt of attempts) {
    const { data, error } = await attempt()

    if (!error) return { data, error: null }

    lastError = error
    if (!isAnnouncementColumnError(error)) break
  }

  return { data: null, error: lastError }
}

function normalizeAnnouncementRow(announcement: any) {
  return {
    ...announcement,
    image_url: announcement.image_url || null,
    excerpt: announcement.excerpt || null,
    published_at: announcement.published_at || null,
    expires_at: announcement.expires_at || null,
    pinned: Boolean(announcement.pinned),
  }
}

/**
 * Residents only see published announcements that are past their publish time
 * (a future `published_at` is a schedule) and not yet expired. This is resolved
 * at read time, so scheduling needs no background job.
 */
export async function getPublishedAnnouncements() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await runUntilColumnSupport<any>([
    () =>
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS_FULL)
        .eq('is_published', true)
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false }),
    () =>
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS_NO_PIN)
        .eq('is_published', true)
        .lte('published_at', now)
        .order('published_at', { ascending: false }),
    () =>
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS_BASE)
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
  ])

  if (error) throw new Error(`Failed to get announcements: ${error.message}`)

  return (data || []).map(normalizeAnnouncementRow)
}

export async function getPublishedAnnouncementById(id: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // Scheduled and expired announcements are hidden even when the id is known,
  // so a direct link to one renders the not-found page.
  const { data, error } = await runUntilColumnSupport<any>([
    () =>
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS_FULL)
        .eq('is_published', true)
        .eq('id', id)
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .maybeSingle(),
    () =>
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS_NO_PIN)
        .eq('is_published', true)
        .eq('id', id)
        .lte('published_at', now)
        .maybeSingle(),
    () =>
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS_BASE)
        .eq('is_published', true)
        .eq('id', id)
        .maybeSingle(),
  ])

  if (error?.code === 'PGRST116') {
    return null
  }
  if (error) throw new Error(`Failed to get announcement: ${error.message}`)
  if (!data) return null

  return normalizeAnnouncementRow(data)
}

// Admin functions
export async function getAllRequests() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('requests')
    .select('id, resident_id, request_type, title, description, category, payload, status, priority, created_at, updated_at, residents(first_name, last_name, email, barangay)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get requests: ${error.message}`)
  return data || []
}

export async function getAllComplaints() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('complaints')
    .select('*, residents(first_name, last_name, email, barangay)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get complaints: ${error.message}`)
  return data || []
}

export async function getAllResidents() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('residents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get residents: ${error.message}`)
  return data || []
}

export async function updateRequestStatus(requestId: string, status: string) {
  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('requests')
    .select('status')
    .eq('id', requestId)
    .single()

  if (fetchError) throw new Error(`Failed to load request: ${fetchError.message}`)

  // Enforce the request status finite state machine
  const nextStatus = assertRequestTransition(current?.status, status)

  const { data, error } = await supabase
    .from('requests')
    .update({ status: nextStatus, updated_at: new Date() })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update request: ${error.message}`)
  return data
}

export async function updateComplaintStatus(complaintId: string, status: string) {
  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('complaints')
    .select('status')
    .eq('id', complaintId)
    .single()

  if (fetchError) throw new Error(`Failed to load complaint: ${fetchError.message}`)

  // Enforce the complaint status finite state machine
  const nextStatus = assertComplaintTransition(current?.status, status)

  const { data, error } = await supabase
    .from('complaints')
    .update({ status: nextStatus, updated_at: new Date() })
    .eq('id', complaintId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update complaint: ${error.message}`)
  return data
}

export async function getAllDesignations() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('designations')
    .select('*')
    .order('priority_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(`Failed to get designations: ${error.message}`)
  return data || []
}

export async function createDesignation(input: DesignationInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('designations')
    .insert([
      {
        name: input.name,
        category: input.category,
        priority_order: input.priorityOrder,
        badge_color: input.badgeColor,
      },
    ])
    .select()
    .single()

  if (error) throw new Error(`Failed to create designation: ${error.message}`)
  return data
}

export async function updateDesignation(designationId: string, input: DesignationInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('designations')
    .update({
      name: input.name,
      category: input.category,
      priority_order: input.priorityOrder,
      badge_color: input.badgeColor,
      updated_at: new Date(),
    })
    .eq('id', designationId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update designation: ${error.message}`)
  return data
}

export async function deleteDesignation(designationId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('designations').delete().eq('id', designationId)

  if (error) throw new Error(`Failed to delete designation: ${error.message}`)
}

export async function getAllOfficials() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('officials')
    .select('*, designations(id, name, category, priority_order, badge_color)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get officials: ${error.message}`)
  return data || []
}

export async function createOfficial(input: OfficialInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('officials')
    .insert([
      {
        full_name: input.fullName,
        designation_id: input.designationId,
        contact_number: input.contactNumber || null,
        email: input.email || null,
        term_start: input.termStart,
        term_end: input.termEnd,
        status: input.status,
        photo: input.photo || null,
      },
    ])
    .select('*, designations(id, name, category, priority_order, badge_color)')
    .single()

  if (error) throw new Error(`Failed to create official: ${error.message}`)
  return data
}

export async function updateOfficial(officialId: string, input: OfficialInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('officials')
    .update({
      full_name: input.fullName,
      designation_id: input.designationId,
      contact_number: input.contactNumber || null,
      email: input.email || null,
      term_start: input.termStart,
      term_end: input.termEnd,
      status: input.status,
      photo: input.photo || null,
      updated_at: new Date(),
    })
    .eq('id', officialId)
    .select('*, designations(id, name, category, priority_order, badge_color)')
    .single()

  if (error) throw new Error(`Failed to update official: ${error.message}`)
  return data
}

export async function deleteOfficial(officialId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('officials').delete().eq('id', officialId)

  if (error) throw new Error(`Failed to delete official: ${error.message}`)
}

export async function countOfficialsByDesignation(designationId: string) {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('officials')
    .select('id', { count: 'exact', head: true })
    .eq('designation_id', designationId)

  if (error) throw new Error(`Failed to count officials: ${error.message}`)
  return count || 0
}

// System Settings functions
export async function getSystemSettings() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')

  if (error) {
    logger.warn('Failed to get system settings', { context: 'lib/db', error: error.message })
    return {}
  }
  
  // Convert array of {setting_key, value} to object {setting_key: value}
  const settings: Record<string, any> = {}
  data?.forEach((item) => {
    settings[item.setting_key] = item.value
  })
  return settings
}

export async function getSystemSetting(key: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('setting_key', key)
    .single()

  if (error?.code === 'PGRST116') {
    return null // Not found
  }
  if (error) {
    logger.warn(`Failed to get system setting ${key}`, { context: 'lib/db', error: error.message })
    return null
  }

  return data?.value ?? null
}

export async function updateSystemSetting(key: string, value: any) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key: key,
      value,
      updated_at: new Date(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to update system setting ${key}: ${error.message}`)
  return data
}

export async function updateBarangayInfo(input: BarangayInfoInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key: 'barangay_info',
      value: input,
      updated_at: new Date(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to update barangay info: ${error.message}`)
  return data
}

export async function updateMissionVision(input: MissionVisionInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key: 'mission_vision',
      value: input,
      updated_at: new Date(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to update mission vision: ${error.message}`)
  return data
}

export async function updateSignatureUpload(input: SignatureUploadInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key: 'signature_uploads',
      value: input,
      updated_at: new Date(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to update signature uploads: ${error.message}`)
  return data
}

// Service Categories functions
export async function getServiceCategories(categoryType?: string, includeInactive = false) {
  const supabase = await createClient()

  let query = supabase
    .from('service_categories')
    .select('*')

  if (categoryType) {
    query = query.eq('category_type', categoryType)
  }

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query.order('sort_order', { ascending: true }).order('title', { ascending: true })

  if (error) {
    logger.warn('Failed to get service categories', { context: 'lib/db', error: error.message })
    return []
  }

  return data || []
}

export async function getServiceCategoryById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') {
    return null
  }
  if (error) {
    logger.warn(`Failed to get service category ${id}`, { context: 'lib/db', error: error.message })
    return null
  }

  return data
}

export async function createServiceCategory(input: ServiceCategoryInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_categories')
    .insert([{
      slug: input.slug,
      title: input.title,
      description: input.description || null,
      category_type: input.category_type,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 999,
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create service category: ${error.message}`)
  return data
}

export async function updateServiceCategory(id: string, input: ServiceCategoryInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_categories')
    .update({
      slug: input.slug,
      title: input.title,
      description: input.description || null,
      category_type: input.category_type,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 999,
      updated_at: new Date(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update service category: ${error.message}`)
  return data
}

export async function toggleServiceCategoryActive(id: string, isActive: boolean) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_categories')
    .update({
      is_active: isActive,
      updated_at: new Date(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to toggle service category: ${error.message}`)
  return data
}

export async function deleteServiceCategory(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('service_categories').delete().eq('id', id)

  if (error) throw new Error(`Failed to delete service category: ${error.message}`)
}

export async function getServiceCategoryRequirements(categoryId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_category_requirements')
    .select('*')
    .eq('service_category_id', categoryId)
    .order('sort_order', { ascending: true })

  if (error) {
    logger.warn(`Failed to get requirements for category ${categoryId}`, { context: 'lib/db', error: error.message })
    return []
  }

  return data || []
}

// ============================================================================
// Identity Verification functions
// ============================================================================

export interface PreRegisteredResidentData {
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth?: string
  email: string
  phone?: string
  streetAddress?: string
  barangay: string
  cityMunicipality?: string
  province?: string
  postalCode?: string
  nationalId?: string
  idType?: string
  source?: string
  importBatchId?: string
}

export async function createPreRegisteredResident(data: PreRegisteredResidentData) {
  const supabase = await createClient()

  const { data: result, error } = await supabase
    .from('pre_registered_residents')
    .insert([
      {
        first_name: data.firstName,
        last_name: data.lastName,
        middle_name: data.middleName || null,
        date_of_birth: data.dateOfBirth || null,
        email: data.email,
        phone: data.phone || null,
        street_address: data.streetAddress || null,
        barangay: data.barangay,
        city_municipality: data.cityMunicipality || null,
        province: data.province || 'Metro Manila',
        postal_code: data.postalCode || null,
        national_id: data.nationalId || null,
        id_type: data.idType || null,
        source: data.source || 'manual',
        import_batch_id: data.importBatchId || null,
      },
    ])
    .select()
    .single()

  if (error) throw new Error(`Failed to create pre-registered resident: ${error.message}`)
  return result
}

export interface PreRegisteredCandidateFilters {
  email?: string | null
  phone?: string | null
  nationalId?: string | null
  firstName?: string | null
  lastName?: string | null
}

/**
 * Candidate lookup for identity verification.
 *
 * IMPORTANT: `pre_registered_residents` is admin-only under RLS, so callers
 * MUST pass a service-role client from `createAdminClient()`. Reading this
 * table with the resident-scoped client returns zero rows *without* raising
 * an error, which silently made every ID verification report a 0% match.
 *
 * Identity filters are OR-ed together because a single ID photo may only
 * expose one of them; the name prefix search is a last resort for records
 * that have no email, phone, or national ID on file.
 */
export async function findPreRegisteredCandidates(
  filters: PreRegisteredCandidateFilters,
  client: SupabaseClient,
): Promise<PreRegisteredResident[]> {
  const orFilters: string[] = []

  const email = filters.email?.trim().toLowerCase()
  if (email) {
    orFilters.push(`email.eq.${email}`)
  }

  const phone = filters.phone?.replace(/\D/g, '')
  if (phone) {
    orFilters.push(`phone.like.*${phone}*`)
  }

  const nationalId = filters.nationalId?.replace(/\D/g, '')
  if (nationalId) {
    orFilters.push(`national_id.like.*${nationalId}*`)
  }

  if (orFilters.length > 0) {
    const { data, error } = await client
      .from('pre_registered_residents')
      .select('*')
      .or(orFilters.join(','))
      .limit(50)

    if (error) throw new Error(`Failed to search pre-registered residents: ${error.message}`)
    return (data ?? []) as PreRegisteredResident[]
  }

  const firstName = filters.firstName?.trim().toLowerCase()
  const lastName = filters.lastName?.trim().toLowerCase()

  if (firstName && lastName) {
    const { data, error } = await client
      .from('pre_registered_residents')
      .select('*')
      .ilike('first_name', `${firstName}%`)
      .ilike('last_name', `${lastName}%`)
      .limit(50)

    if (error) throw new Error(`Failed to search pre-registered residents: ${error.message}`)
    return (data ?? []) as PreRegisteredResident[]
  }

  return []
}

export interface DuplicateResidentFilters {
  email?: string | null
  phone?: string | null
  nationalId?: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
}

export interface DuplicateResidentMatch {
  id: string
  email: string
  first_name: string
  last_name: string
  /** Which identity signals matched: 'national_id' | 'phone' | 'name_dob' */
  matchedOn: string[]
}

/**
 * Detects already-registered resident accounts that belong to the same person
 * as a new sign-up, so one resident cannot create multiple accounts with
 * different emails. Checks are additive: a single sign-up may trip several.
 *
 * MUST be called with a service-role client (`createAdminClient()`) because
 * `residents` is RLS-scoped to the signed-in user — an anonymous request
 * client would silently return zero rows and skip the check.
 *
 * Phone and national ID comparisons use digits-only normalization to tolerate
 * formatting differences (spaces, dashes, +63 vs 09 prefixes are NOT
 * equated for phone — only separators are stripped).
 */
export async function findDuplicateResidentAccounts(
  filters: DuplicateResidentFilters,
  client: SupabaseClient,
): Promise<DuplicateResidentMatch[]> {
  const matches = new Map<string, DuplicateResidentMatch>()

  const record = (row: DuplicateResidentMatchBase, reason: string) => {
    const existing = matches.get(row.id)
    if (existing) {
      if (!existing.matchedOn.includes(reason)) existing.matchedOn.push(reason)
    } else {
      matches.set(row.id, { ...row, matchedOn: [reason] })
    }
  }

  type DuplicateResidentMatchBase = Pick<DuplicateResidentMatch, 'id' | 'email' | 'first_name' | 'last_name'>
  const columns = 'id, email, first_name, last_name'

  // 1. National ID — strongest signal. Normalize both sides to digits.
  const nationalId = filters.nationalId?.replace(/\D/g, '')
  if (nationalId) {
    const { data, error } = await client
      .from('residents')
      .select(columns)
      .like('national_id', `*${nationalId}*`)
      .limit(10)
    if (error) throw new Error(`Failed to check duplicate national ID: ${error.message}`)
    for (const row of (data ?? []) as DuplicateResidentMatchBase[]) record(row, 'national_id')
  }

  // 2. Phone number — normalized to digits before comparing.
  const phone = filters.phone?.replace(/\D/g, '')
  if (phone) {
    const { data, error } = await client
      .from('residents')
      .select(columns)
      .like('phone', `*${phone}*`)
      .limit(10)
    if (error) throw new Error(`Failed to check duplicate phone: ${error.message}`)
    for (const row of (data ?? []) as DuplicateResidentMatchBase[]) record(row, 'phone')
  }

  // 3. Full name + exact date of birth.
  const firstName = filters.firstName?.trim()
  const lastName = filters.lastName?.trim()
  const dateOfBirth = filters.dateOfBirth?.trim()
  if (firstName && lastName && dateOfBirth) {
    const { data, error } = await client
      .from('residents')
      .select(columns)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .eq('date_of_birth', dateOfBirth)
      .limit(10)
    if (error) throw new Error(`Failed to check duplicate name/DOB: ${error.message}`)
    for (const row of (data ?? []) as DuplicateResidentMatchBase[]) record(row, 'name_dob')
  }

  return Array.from(matches.values())
}

export async function getPreRegisteredResidentById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pre_registered_residents')
    .select('*')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw new Error(`Failed to get pre-registered resident: ${error.message}`)
  return data
}

export async function getResidentVerification(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('residents')
    .select(
      'id, verification_status, verification_method, verification_confidence, verification_details, id_document_type, id_document_url, verified_at, verified_by',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Failed to get resident verification: ${error.message}`)
  return data?.[0] ?? null
}

export async function updateResidentVerification(
  residentId: string,
  updates: {
    verificationStatus?: string
    verificationMethod?: string
    verificationConfidence?: number
    verificationDetails?: Record<string, unknown>
    idDocumentType?: string
    idDocumentUrl?: string
    verifiedAt?: string
    verifiedBy?: string
  },
) {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (updates.verificationStatus) updateData.verification_status = updates.verificationStatus
  if (updates.verificationMethod) updateData.verification_method = updates.verificationMethod
  if (updates.verificationConfidence !== undefined) updateData.verification_confidence = updates.verificationConfidence
  if (updates.verificationDetails) updateData.verification_details = updates.verificationDetails
  if (updates.idDocumentType) updateData.id_document_type = updates.idDocumentType
  if (updates.idDocumentUrl) updateData.id_document_url = updates.idDocumentUrl
  if (updates.verifiedAt) updateData.verified_at = updates.verifiedAt
  if (updates.verifiedBy) updateData.verified_by = updates.verifiedBy
  updateData.updated_at = new Date()

  const { data, error } = await supabase
    .from('residents')
    .update(updateData)
    .eq('id', residentId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update resident verification: ${error.message}`)
  return data
}

export interface VerificationAttemptData {
  residentId: string
  attemptType: 'form_match' | 'id_ocr' | 'manual_review'
  inputData?: Record<string, unknown>
  matchedPreRegisteredId?: string
  matchScore?: number
  confidenceBreakdown?: Record<string, number>
  ocrExtractedData?: Record<string, unknown>
  status: 'matched' | 'no_match' | 'needs_review' | 'rejected'
}

export async function logVerificationAttempt(data: VerificationAttemptData) {
  const supabase = await createClient()

  const { data: result, error } = await supabase
    .from('verification_attempts')
    .insert([
      {
        resident_id: data.residentId,
        attempt_type: data.attemptType,
        input_data: data.inputData || null,
        matched_pre_registered_id: data.matchedPreRegisteredId || null,
        match_score: data.matchScore || null,
        confidence_breakdown: data.confidenceBreakdown || null,
        ocr_extracted_data: data.ocrExtractedData || null,
        status: data.status,
      },
    ])
    .select()
    .single()

  if (error) throw new Error(`Failed to log verification attempt: ${error.message}`)
  return result
}

export async function getVerificationAttempts(filters?: {
  status?: string
  residentId?: string
  limit?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('verification_attempts')
    .select(`
      *,
      residents!inner(id, first_name, last_name, email, verification_status),
      pre_registered_residents!left(id, first_name, last_name, email, national_id)
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.residentId) {
    query = query.eq('resident_id', filters.residentId)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to get verification attempts: ${error.message}`)
  return data || []
}

export async function getVerificationAttemptById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('verification_attempts')
    .select(`
      *,
      residents!inner(id, user_id, first_name, last_name, email, verification_status),
      pre_registered_residents!left(id, first_name, last_name, email, national_id)
    `)
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw new Error(`Failed to get verification attempt: ${error.message}`)
  return data
}

export async function updateVerificationAttempt(
  attemptId: string,
  updates: {
    status?: string
    reviewedBy?: string
  },
) {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (updates.status) updateData.status = updates.status
  if (updates.reviewedBy) updateData.reviewed_by = updates.reviewedBy
  if (updates.reviewedBy) updateData.reviewed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('verification_attempts')
    .update(updateData)
    .eq('id', attemptId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update verification attempt: ${error.message}`)
  return data
}

/**
 * Fair-use cap for ID uploads: counts the resident's OCR attempts in the last
 * `hours` hours. Uses the service-role client because the count must work
 * before/at upload time regardless of the resident's verification RLS state.
 * Returns -1 when the profile can't be resolved so callers fail open (an
 * anonymous edge case should not lock anyone out of verification).
 */
export async function getRecentVerificationAttemptCount(
  userId: string,
  hours = 24,
): Promise<number> {
  const adminClient = createAdminClient()

  const { data: resident, error: residentError } = await adminClient
    .from('residents')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (residentError) throw new Error(`Failed to resolve resident: ${residentError.message}`)
  if (!resident) return -1

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { count, error } = await adminClient
    .from('verification_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('resident_id', resident.id)
    .gte('created_at', cutoff)

  if (error) throw new Error(`Failed to count verification attempts: ${error.message}`)
  return count ?? 0
}

export interface UserNotificationData {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
}

/**
 * Inserts an in-app notification for a citizen. Intentionally uses the
 * service-role client: the user_notifications table has no INSERT policy, so
 * only server code can create notifications.
 */
export async function createUserNotification(data: UserNotificationData) {
  const adminClient = createAdminClient()

  const { error } = await adminClient.from('user_notifications').insert({
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body ?? null,
    link: data.link ?? null,
  })

  if (error) throw new Error(`Failed to create user notification: ${error.message}`)
}
