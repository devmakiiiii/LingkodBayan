import { z } from 'zod'
import { requestTypes } from './request-types.ts'
import { designationCategories, officialStatuses } from './governance.ts'
import { BARANGAY_FULL_LABEL, BARANGAY_NAME } from './barangay.ts'

// Barangay identity lives in the dependency-free ./barangay module so that UI
// copy, metadata and server actions can share it without bundling zod. It is
// re-exported here so `@/lib/schemas` keeps working for existing callers.
export * from './barangay.ts'

// Minimum password length for every account-creating or password-changing path.
// Shared so the sign-up wizard, the reset form, and the server actions cannot
// drift apart. Supabase's own project minimum is lower, so this is the binding
// rule; keeping it in one place makes the error copy consistent too.
export const MIN_PASSWORD_LENGTH = 8
const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordField,
})

// Only Barangay Barretto is accepted; anything else is rejected so stray
// multi-barangay data cannot enter the records.
export const signUpBarangaySchema = z.literal(BARANGAY_NAME, {
  errorMap: () => ({ message: `LingkodBayan only serves ${BARANGAY_FULL_LABEL}` }),
})

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordField,
  confirmPassword: passwordField,
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  barangay: signUpBarangaySchema,
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
  // The designation's standing rank within its category (migration 42). Named
  // `rank`, not `priority`, to avoid confusion with requests.priority and
  // complaints.priority_level, which are per-item triage urgency.
  //
  // Optional: blank/undefined means "assign the next rank in this category"
  // (max + 1). An explicit number is still allowed as an override, and must be
  // unique within the category.
  rank: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined
      if (typeof value === 'string' && value.trim() === '') return undefined
      return value
    },
    z.coerce
      .number({ invalid_type_error: 'Rank must be a number' })
      .int('Rank must be a whole number')
      .min(1, 'Rank must be at least 1')
      .optional(),
  ),
  // Badge color is deliberately NOT stored. It is derived from the category by
  // getDesignationBadgeColor() (migration 43) - a per-designation color implied
  // distinctions that did not exist and had to be picked by hand.
})

export const officialSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(2, 'Full name is required'),
  // Structured name parts (migration 41). The Add/Edit Official form requires
  // first + last name and composes fullName from them; they stay optional here
  // so legacy rows and older write paths remain valid.
  firstName: z.string().min(1, 'First name is required').optional().or(z.literal('')),
  // Officials are recorded with a middle initial only (residents keep a full
  // middle name on their own table), so this holds one letter and a period.
  middleInitial: z
    .string()
    .regex(/^[A-Za-z]?\.?$/, 'Middle initial must be a single letter, e.g. S.')
    .optional()
    .or(z.literal('')),
  lastName: z.string().min(1, 'Last name is required').optional().or(z.literal('')),
  suffix: z.string().optional().or(z.literal('')),
  designationId: z.string().uuid('Designation is required'),
  contactNumber: z.string().min(5, 'Contact number is required').optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  // Tenure dates are OPTIONAL. Officials are frequently recorded before the
  // term is known, and nothing downstream requires the value: the officials
  // list, view modal and reports all render a blank term as "N/A" through
  // getOfficialTermDuration(). Requiring them only blocked record creation.
  termStart: z.string().optional().or(z.literal('')),
  termEnd: z.string().optional().or(z.literal('')),
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

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  password: passwordField,
  confirmPassword: passwordField,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
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
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// Identity Verification schemas
export const verificationMatchSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  barangay: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().optional(),
})

export const verificationAppealSchema = z.object({
  note: z
    .string()
    .max(1000, 'Appeal note must be 1000 characters or less')
    .optional(),
})

export const preRegisteredResidentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  streetAddress: z.string().optional(),
  barangay: z.string().min(1, 'Barangay is required'),
  cityMunicipality: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  nationalId: z.string().optional(),
  idType: z.string().optional(),
  source: z.string().optional(),
  importBatchId: z.string().optional(),
})

export const verificationReviewSchema = z.object({
  status: z.enum(['matched', 'rejected']),
  notes: z.string().optional(),
})

export type VerificationMatchInput = z.infer<typeof verificationMatchSchema>
export type PreRegisteredResidentInput = z.infer<typeof preRegisteredResidentSchema>
export type VerificationReviewInput = z.infer<typeof verificationReviewSchema>
export type VerificationAppealInput = z.infer<typeof verificationAppealSchema>

// API payload schemas for route validation
export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  is_published: z.boolean().default(false),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  excerpt: z.string().max(500, 'Excerpt must be 500 characters or less').optional().or(z.literal('')),
  // Scheduling: an empty publish_at means "publish now" when is_published is set.
  publish_at: z.string().trim().optional().nullable(),
  expires_at: z.string().trim().optional().nullable(),
  pinned: z.boolean().optional(),
})

export const updateAnnouncementSchema = z.object({
  id: z.string().uuid('Invalid announcement ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  is_published: z.boolean().default(false),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  excerpt: z.string().max(500, 'Excerpt must be 500 characters or less').optional().or(z.literal('')),
  // Scheduling: an empty publish_at means "publish now" when is_published is set.
  publish_at: z.string().trim().optional().nullable(),
  expires_at: z.string().trim().optional().nullable(),
  pinned: z.boolean().optional(),
})

export const deleteAnnouncementSchema = z.object({
  id: z.string().uuid('Invalid announcement ID'),
})

// Narrow schema for the Manage table's publish/unpublish toggle, which only
// sends the id and the new publish state.
export const setAnnouncementPublishStateSchema = z.object({
  id: z.string().uuid('Invalid announcement ID'),
  is_published: z.boolean(),
})

export type SetAnnouncementPublishStateInput = z.infer<typeof setAnnouncementPublishStateSchema>

export const complaintReplySchema = z.object({
  complaintId: z.string().uuid('Invalid complaint ID'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be 2000 characters or less'),
})

export const cancelComplaintSchema = z.object({
  complaintId: z.string().uuid('Invalid complaint ID'),
})

/**
 * Admin-authored complaint messages (replies and automatic status/assignment
 * activity notes) submitted through /api/admin/complaint-messages.
 */
export const adminComplaintMessageSchema = z.object({
  complaintId: z.string().uuid('Invalid complaint ID'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be 2000 characters or less'),
  messageType: z.enum(['reply', 'system']).default('reply'),
})

export type AdminComplaintMessageInput = z.infer<typeof adminComplaintMessageSchema>

export const processIdVerificationSchema = z.object({
  signedUrl: z.string().url('Invalid signed URL'),
  idType: z.string().default('philsys'),
  expectedValues: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    middleName: z.string().optional(),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationalId: z.string().optional(),
    barangay: z.string().optional(),
    address: z.string().optional(),
  }),
})

