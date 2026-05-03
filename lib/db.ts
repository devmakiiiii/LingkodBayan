import { createClient } from '@/lib/supabase/server'
import { RequestInput, ComplaintInput, DesignationInput, OfficialInput, BarangayInfoInput, MissionVisionInput, SignatureUploadInput, ServiceCategoryInput } from './schemas'

export async function createResident(userData: {
  userId: string
  firstName: string
  lastName: string
  email: string
  barangay: string
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.from('residents').insert([
    {
      user_id: userData.userId,
      first_name: userData.firstName,
      last_name: userData.lastName,
      email: userData.email,
      barangay: userData.barangay,
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

export async function createRequest(residentId: string, input: RequestInput) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.from('requests').insert([
    {
      resident_id: residentId,
      request_type: input.requestType,
      title: input.title,
      description: input.description,
      category: input.category,
      payload: input.payload,
      status: 'pending',
      priority: 'normal',
    },
  ]).select().single()

  if (error) throw new Error(`Failed to create request: ${error.message}`)
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

export async function createComplaint(residentId: string, input: ComplaintInput) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.from('complaints').insert([
    {
      resident_id: residentId,
      title: input.title,
      description: input.description,
      category: input.category,
      status: 'open',
      priority: 'normal',
    },
  ]).select().single()

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

export async function getPublishedAnnouncements() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get announcements: ${error.message}`)
  return data || []
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
  
  const { data, error } = await supabase
    .from('requests')
    .update({ status, updated_at: new Date() })
    .eq('id', requestId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update request: ${error.message}`)
  return data
}

export async function updateComplaintStatus(complaintId: string, status: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('complaints')
    .update({ status, updated_at: new Date() })
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
    console.warn('Failed to get system settings:', error.message)
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
    console.warn(`Failed to get system setting ${key}:`, error.message)
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
    console.warn('Failed to get service categories:', error.message)
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
    console.warn(`Failed to get service category ${id}:`, error.message)
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
    console.warn(`Failed to get requirements for category ${categoryId}:`, error.message)
    return []
  }

  return data || []
}
