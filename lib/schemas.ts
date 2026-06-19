import { z } from 'zod'
import { requestTypes } from './request-types'
import { designationCategories, officialStatuses } from './governance'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const requestSchema = z.object({
  requestType: z.enum(requestTypes),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  payload: z.record(z.string(), z.any()),
})

export const complaintSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
})

export const designationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, 'Designation name is required'),
  category: z.enum(designationCategories),
  priorityOrder: z.coerce.number().int().min(1, 'Priority order must be at least 1'),
  badgeColor: z.string().min(4, 'Badge color is required'),
})

export const officialSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(2, 'Full name is required'),
  designationId: z.string().uuid('Designation is required'),
  contactNumber: z.string().min(5, 'Contact number is required').optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  termStart: z.string().min(1, 'Term start date is required'),
  termEnd: z.string().min(1, 'Term end date is required'),
  status: z.enum(officialStatuses),
  photo: z.string().optional().or(z.literal('')),
})

// System settings schemas
export const barangayInfoSchema = z.object({
  barangay_name: z.string().min(1, 'Barangay name is required'),
  address: z.string().min(1, 'Address is required'),
  contact_number: z.string().min(5, 'Contact number is required'),
  email: z.string().email('Invalid email address'),
  office_hours: z.string().min(1, 'Office hours is required'),
})

export const missionVisionSchema = z.object({
  mission: z.string().min(10, 'Mission must be at least 10 characters'),
  vision: z.string().min(10, 'Vision must be at least 10 characters'),
  core_values: z.array(z.string().min(1, 'Core value cannot be empty')).min(1, 'At least one core value is required'),
})

export const signatureUploadSchema = z.object({
  captain_signature_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  secretary_signature_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

// Service categories schemas
export const serviceCategorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category_type: z.enum(['document', 'appointment'], {
    errorMap: () => ({ message: 'Category type must be document or appointment' }),
  }),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0, 'Sort order must be 0 or greater').default(999),
})

export const serviceCategoryRequirementSchema = z.object({
  id: z.string().uuid().optional(),
  requirement_key: z.string().min(1, 'Requirement key is required').regex(/^[a-z_]+$/, 'Key must be lowercase with underscores'),
  requirement_label: z.string().min(1, 'Requirement label is required'),
  is_required: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0, 'Sort order must be 0 or greater').default(999),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type RequestInput = z.infer<typeof requestSchema>
export type ComplaintInput = z.infer<typeof complaintSchema>
export type DesignationInput = z.infer<typeof designationSchema>
export type OfficialInput = z.infer<typeof officialSchema>
export type BarangayInfoInput = z.infer<typeof barangayInfoSchema>
export type MissionVisionInput = z.infer<typeof missionVisionSchema>
export type SignatureUploadInput = z.infer<typeof signatureUploadSchema>
export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>
export type ServiceCategoryRequirementInput = z.infer<typeof serviceCategoryRequirementSchema>
