import { createClient } from '@/lib/supabase/server'
import { RequestInput, ComplaintInput } from './schemas'

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
