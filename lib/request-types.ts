export const requestTypes = [
  'barangay-clearance',
  'certificate-residency',
  'business-permit',
  'good-moral',
  'indigency',
] as const

export type RequestType = (typeof requestTypes)[number]

export const requestStatuses = [
  'pending',
  'processing',
  'approved',
  'rejected',
] as const

export type RequestStatus = (typeof requestStatuses)[number]

export type RequestFieldType = 'text' | 'textarea' | 'date' | 'number' | 'tel' | 'select' | 'file'

export type RequestPayloadValue = string | number | boolean | null | RequestFileValue[] | Record<string, unknown>

export type RequestPayload = Record<string, RequestPayloadValue>

export type RequestFileValue = {
  name: string
  type: string
  size: number
  content: string
}

export interface RequestFieldConfig {
  name: string
  label: string
  type: RequestFieldType
  placeholder?: string
  required?: boolean
  helperText?: string
  multiple?: boolean
  accept?: string
  options?: Array<{ label: string; value: string }>
}

export interface RequestTypeConfig {
  requestType: RequestType
  title: string
  category: string
  summaryField: string
  fields: RequestFieldConfig[]
}

export const requestTypeConfigs: Record<RequestType, RequestTypeConfig> = {
  'barangay-clearance': {
    requestType: 'barangay-clearance',
    title: 'Barangay Clearance',
    category: 'Clearance',
    summaryField: 'purpose',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Juan Dela Cruz' },
      { name: 'address', label: 'Address', type: 'textarea', required: true, placeholder: 'House No., Street, Barangay' },
      { name: 'contactNumber', label: 'Contact Number', type: 'tel', required: true, placeholder: '09xx xxx xxxx' },
      { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
      {
        name: 'civilStatus',
        label: 'Civil Status',
        type: 'select',
        required: true,
        options: [
          { label: 'Single', value: 'Single' },
          { label: 'Married', value: 'Married' },
          { label: 'Widowed', value: 'Widowed' },
          { label: 'Separated', value: 'Separated' },
        ],
      },
      { name: 'purpose', label: 'Purpose', type: 'textarea', required: true, placeholder: 'State the purpose of the clearance' },
      { name: 'validIdUpload', label: 'Valid ID Upload', type: 'file', required: true, accept: '.jpg,.jpeg,.png,.pdf', helperText: 'Upload one valid government ID' },
    ],
  },
  'certificate-residency': {
    requestType: 'certificate-residency',
    title: 'Certificate of Residency',
    category: 'Certificate',
    summaryField: 'purpose',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Juan Dela Cruz' },
      { name: 'address', label: 'Address', type: 'textarea', required: true, placeholder: 'Complete address' },
      { name: 'yearsOfStay', label: 'Years of Stay', type: 'number', required: true, placeholder: '5' },
      { name: 'contactNumber', label: 'Contact Number', type: 'tel', required: true, placeholder: '09xx xxx xxxx' },
      { name: 'purpose', label: 'Purpose', type: 'textarea', required: true, placeholder: 'State the purpose of the certificate' },
    ],
  },
  'business-permit': {
    requestType: 'business-permit',
    title: 'Business Permit',
    category: 'Permit',
    summaryField: 'businessName',
    fields: [
      { name: 'ownerName', label: 'Owner Name', type: 'text', required: true, placeholder: 'Juan Dela Cruz' },
      { name: 'businessName', label: 'Business Name', type: 'text', required: true, placeholder: 'Dela Cruz Sari-Sari Store' },
      { name: 'businessAddress', label: 'Business Address', type: 'textarea', required: true, placeholder: 'Business location' },
      { name: 'businessType', label: 'Business Type', type: 'text', required: true, placeholder: 'Retail, Food, Services, etc.' },
      { name: 'contactNumber', label: 'Contact Number', type: 'tel', required: true, placeholder: '09xx xxx xxxx' },
      { name: 'businessDocuments', label: 'Upload Business Documents', type: 'file', required: true, multiple: true, accept: '.jpg,.jpeg,.png,.pdf,.doc,.docx', helperText: 'You can upload multiple supporting files' },
    ],
  },
  'good-moral': {
    requestType: 'good-moral',
    title: 'Good Moral Certificate',
    category: 'Certificate',
    summaryField: 'purpose',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Juan Dela Cruz' },
      { name: 'address', label: 'Address', type: 'textarea', required: true, placeholder: 'Complete address' },
      { name: 'schoolCompanyName', label: 'School/Company Name', type: 'text', required: true, placeholder: 'School or company name' },
      { name: 'purpose', label: 'Purpose', type: 'textarea', required: true, placeholder: 'Why do you need the certificate?' },
      { name: 'contactNumber', label: 'Contact Number', type: 'tel', required: true, placeholder: '09xx xxx xxxx' },
    ],
  },
  indigency: {
    requestType: 'indigency',
    title: 'Indigency Certificate',
    category: 'Assistance',
    summaryField: 'reasonForRequest',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Juan Dela Cruz' },
      { name: 'address', label: 'Address', type: 'textarea', required: true, placeholder: 'Complete address' },
      { name: 'familyIncome', label: 'Family Income', type: 'number', required: true, placeholder: '0' },
      { name: 'reasonForRequest', label: 'Reason for Request', type: 'textarea', required: true, placeholder: 'Explain your reason for requesting this certificate' },
      { name: 'contactNumber', label: 'Contact Number', type: 'tel', required: true, placeholder: '09xx xxx xxxx' },
    ],
  },
}

export function getRequestTypeConfig(requestType?: string | null) {
  if (requestType && requestType in requestTypeConfigs) {
    return requestTypeConfigs[requestType as RequestType]
  }

  return null
}

export function getRequestTypeTitle(requestType?: string | null, fallbackTitle?: string | null) {
  return getRequestTypeConfig(requestType)?.title ?? fallbackTitle ?? 'Service Request'
}

export function getRequestStatusLabel(status?: string | null) {
  const normalizedStatus = (status ?? 'pending').toLowerCase()

  if (normalizedStatus === 'in-progress') {
    return 'Processing'
  }

  if (normalizedStatus === 'resolved') {
    return 'Approved'
  }

  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
}

export function getRequestStatusClassName(status?: string | null) {
  switch ((status ?? 'pending').toLowerCase()) {
    case 'approved':
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
    case 'processing':
    case 'in-progress':
      return 'bg-sky-500/10 text-sky-700 border-sky-500/20'
    case 'rejected':
      return 'bg-rose-500/10 text-rose-700 border-rose-500/20'
    case 'pending':
    default:
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20'
  }
}

function formatSimpleValue(value: RequestPayloadValue): string {
  if (value === null || value === undefined) {
    return 'N/A'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' && item && 'name' in item ? String(item.name) : JSON.stringify(item)))
      .join(', ')
  }

  return JSON.stringify(value)
}

export function formatRequestFieldValue(value: RequestPayloadValue) {
  if (Array.isArray(value)) {
    return value
  }

  return formatSimpleValue(value)
}

export function getRequestSummaryValue(requestType?: string | null, payload?: RequestPayload | null, fallbackDescription?: string | null) {
  const config = getRequestTypeConfig(requestType)

  if (!config || !payload) {
    return fallbackDescription ?? 'No summary available'
  }

  const summaryValue = payload[config.summaryField]

  if (Array.isArray(summaryValue)) {
    return summaryValue
      .map((item) => (typeof item === 'object' && item && 'name' in item ? String(item.name) : formatSimpleValue(item as RequestPayloadValue)))
      .join(', ')
  }

  const formattedSummary = formatSimpleValue(summaryValue)

  if (formattedSummary && formattedSummary !== 'N/A') {
    return formattedSummary
  }

  return fallbackDescription ?? 'No summary available'
}

export function getRequestFieldEntries(requestType?: string | null, payload?: RequestPayload | null) {
  const config = getRequestTypeConfig(requestType)

  if (!payload) {
    return []
  }

  const orderedFields = config?.fields ?? []
  const remainingKeys = Object.keys(payload).filter((key) => !orderedFields.some((field) => field.name === key))

  return [
    ...orderedFields.map((field) => ({
      key: field.name,
      label: field.label,
      value: payload[field.name],
      type: field.type,
    })),
    ...remainingKeys.map((key) => ({
      key,
      label: key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (character) => character.toUpperCase())
        .replace(/_/g, ' '),
      value: payload[key],
      type: 'text' as const,
    })),
  ]
}
