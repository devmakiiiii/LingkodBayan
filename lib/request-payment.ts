/**
 * Payment capture for saved service requests.
 *
 * Pure, dependency-free helpers shared by the citizen request form, the
 * request detail views, and the server-side `createRequest` helper. Payment
 * amounts always come from what the Citizen's Charter publishes on
 * `service_categories` (fee_type / fee_amount_min / fee_amount_max /
 * fee_description) — this module never invents a fee.
 *
 * There is no online payment gateway: "pay at counter" stays `unpaid` until
 * the barangay collects it, GCash/Maya submissions are recorded as
 * `pending_verification` (admin verifies the reference number and marks them
 * `paid`), and charter-free services are recorded as `free`.
 */

export const requestPaymentMethods = ['pay_at_counter', 'gcash', 'maya'] as const
export type RequestPaymentMethod = (typeof requestPaymentMethods)[number]

export const requestPaymentStatuses = ['unpaid', 'pending_verification', 'paid', 'free'] as const
export type RequestPaymentStatus = (typeof requestPaymentStatuses)[number]

export const PAYMENT_METHOD_LABELS: Record<RequestPaymentMethod, string> = {
  pay_at_counter: 'Cash at Barangay Counter',
  gcash: 'GCash',
  maya: 'Maya',
}

export const PAYMENT_STATUS_LABELS: Record<RequestPaymentStatus, string> = {
  unpaid: 'To Pay at Counter',
  pending_verification: 'Awaiting Verification',
  paid: 'Paid',
  free: 'Free of Charge',
}

/** Fee fields as they exist on a charter service (or a stored snapshot). */
export interface RequestPaymentFeeInfo {
  feeType?: string | null
  feeAmountMin?: number | null
  feeAmountMax?: number | null
  feeDescription?: string | null
}

/** Raw form state for the payment section of the request form. */
export interface RequestPaymentDraft {
  method: RequestPaymentMethod | ''
  amount?: string | number | null
  referenceNumber?: string | null
}

/** Normalized payment record stored in `requests.payload.payment` and `request_payments`. */
export interface RequestPaymentSnapshot {
  fee_type: string
  fee_amount_min: number | null
  fee_amount_max: number | null
  fee_description: string | null
  amount_paid: number
  payment_method: RequestPaymentMethod
  payment_status: RequestPaymentStatus
  reference_number: string | null
  recorded_at: string
}

/** Fee types where the resident does not enter an amount (charter fixes it). */
const FIXED_AMOUNT_FEE_TYPES = new Set(['free', 'fixed'])
const DIGITAL_METHODS = new Set<RequestPaymentMethod>(['gcash', 'maya'])

export function formatPeso(amount: number): string {
  return `\u20B1${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}

export function isRequestPaymentMethod(value: unknown): value is RequestPaymentMethod {
  return typeof value === 'string' && (requestPaymentMethods as readonly string[]).includes(value)
}

export function isRequestPaymentStatus(value: unknown): value is RequestPaymentStatus {
  return typeof value === 'string' && (requestPaymentStatuses as readonly string[]).includes(value)
}

/** Charter fee type, defaulting to 'unspecified' when the charter is silent. */
export function getFeeType(fee: RequestPaymentFeeInfo): string {
  return fee.feeType ?? 'unspecified'
}

/** True when the resident must type an amount (fee is not fixed by the charter). */
export function requiresAmountEntry(fee: RequestPaymentFeeInfo): boolean {
  return !FIXED_AMOUNT_FEE_TYPES.has(getFeeType(fee))
}

/** Digital payments must carry a reference/transaction number. */
export function requiresReferenceNumber(method: RequestPaymentMethod): boolean {
  return DIGITAL_METHODS.has(method)
}

/**
 * Amount preselected for the draft: 0 for free, the charter amount for fixed
 * fees, and the charter minimum as an adjustable starting point for ranges.
 * Variable/formula/per-page/unspecified fees return null (the office assesses
 * them, or a helper such as `computePerPageAmount` calculates the total).
 */
export function getDefaultPaymentAmount(fee: RequestPaymentFeeInfo): number | null {
  const feeType = getFeeType(fee)
  if (feeType === 'free') return 0
  if (feeType === 'fixed') return fee.feeAmountMin ?? 0
  if (feeType === 'range') return fee.feeAmountMin ?? null
  return null
}

/**
 * Total for a `per_page` fee: charter rate × number of pages.
 * Returns null when the charter sets no rate, or when the page count is
 * missing, zero, negative, fractional, or not a number.
 */
export function computePerPageAmount(
  fee: RequestPaymentFeeInfo,
  pages: string | number | null | undefined,
): number | null {
  const rate = fee.feeAmountMin
  if (rate == null || !Number.isFinite(rate) || rate < 0) return null

  const parsedPages = typeof pages === 'number' ? pages : Number(String(pages ?? '').trim())
  if (!Number.isFinite(parsedPages) || !Number.isInteger(parsedPages) || parsedPages <= 0) {
    return null
  }

  return rate * parsedPages
}

/** Status implied by the chosen method (validated before this is used). */
export function resolvePaymentStatus(
  fee: RequestPaymentFeeInfo,
  method: RequestPaymentMethod,
): RequestPaymentStatus {
  if (getFeeType(fee) === 'free') return 'free'
  if (method === 'pay_at_counter') return 'unpaid'
  return 'pending_verification'
}

function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Validate the payment section against the charter fee.
 * Returns an error message for the form, or null when the payment is valid.
 */
export function validateRequestPayment(
  fee: RequestPaymentFeeInfo,
  draft: RequestPaymentDraft,
): string | null {
  const feeType = getFeeType(fee)

  // Free services record a zero payment; no method or amount is needed.
  if (feeType === 'free') return null

  if (!isRequestPaymentMethod(draft.method)) {
    return 'Please select a payment method.'
  }

  const amount = parseAmount(draft.amount)

  if (Number.isNaN(amount)) {
    return 'Please enter a valid payment amount.'
  }

  if (feeType === 'range') {
    if (amount === null) {
      return 'Please enter the amount to pay.'
    }
    if (fee.feeAmountMin != null && amount < fee.feeAmountMin) {
      return `The fee for this service starts at ${formatPeso(fee.feeAmountMin)}.`
    }
    if (fee.feeAmountMax != null && amount > fee.feeAmountMax) {
      return `The fee for this service must not exceed ${formatPeso(fee.feeAmountMax)}.`
    }
  } else if (requiresAmountEntry(fee) && DIGITAL_METHODS.has(draft.method)) {
    // Variable/formula/per-page/unspecified fees are assessed at the office;
    // a digital payment needs an explicit amount up front.
    if (amount === null || amount <= 0) {
      return 'Please enter the amount you are paying.'
    }
  }

  if (requiresReferenceNumber(draft.method)) {
    const reference = (draft.referenceNumber ?? '').trim()
    if (!reference) {
      return `Please provide the ${PAYMENT_METHOD_LABELS[draft.method]} reference/transaction number.`
    }
  }

  return null
}

/**
 * Build the normalized payment snapshot. Call `validateRequestPayment` first —
 * this function assumes the draft passed validation.
 */
export function buildRequestPaymentSnapshot(
  fee: RequestPaymentFeeInfo,
  draft: RequestPaymentDraft,
  recordedAt: string = new Date().toISOString(),
): RequestPaymentSnapshot {
  const feeType = getFeeType(fee)
  const method: RequestPaymentMethod = isRequestPaymentMethod(draft.method) ? draft.method : 'pay_at_counter'

  let amountPaid = 0
  if (feeType === 'free') {
    amountPaid = 0
  } else if (feeType === 'fixed') {
    amountPaid = fee.feeAmountMin ?? 0
  } else {
    const parsed = parseAmount(draft.amount)
    amountPaid = parsed === null || Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
  }

  return {
    fee_type: feeType,
    fee_amount_min: fee.feeAmountMin ?? null,
    fee_amount_max: fee.feeAmountMax ?? null,
    fee_description: fee.feeDescription ?? null,
    amount_paid: amountPaid,
    payment_method: method,
    payment_status: resolvePaymentStatus(fee, method),
    reference_number: requiresReferenceNumber(method)
      ? (draft.referenceNumber ?? '').trim() || null
      : null,
    recorded_at: recordedAt,
  }
}

/**
 * Read a payment snapshot back out of `requests.payload.payment`.
 * Returns null when absent or structurally invalid (legacy requests).
 */
export function getRequestPayment(payload?: Record<string, unknown> | null): RequestPaymentSnapshot | null {
  const value = payload?.payment
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  if (!isRequestPaymentMethod(record.payment_method) || !isRequestPaymentStatus(record.payment_status)) {
    return null
  }
  if (typeof record.amount_paid !== 'number' || !Number.isFinite(record.amount_paid)) return null

  return {
    fee_type: typeof record.fee_type === 'string' ? record.fee_type : 'unspecified',
    fee_amount_min: typeof record.fee_amount_min === 'number' ? record.fee_amount_min : null,
    fee_amount_max: typeof record.fee_amount_max === 'number' ? record.fee_amount_max : null,
    fee_description: typeof record.fee_description === 'string' ? record.fee_description : null,
    amount_paid: record.amount_paid,
    payment_method: record.payment_method,
    payment_status: record.payment_status,
    reference_number: typeof record.reference_number === 'string' ? record.reference_number : null,
    recorded_at: typeof record.recorded_at === 'string' ? record.recorded_at : '',
  }
}

export function getPaymentMethodLabel(method?: string | null): string {
  return isRequestPaymentMethod(method) ? PAYMENT_METHOD_LABELS[method] : (method ?? 'Not specified')
}

export function getPaymentStatusLabel(status?: string | null): string {
  return isRequestPaymentStatus(status) ? PAYMENT_STATUS_LABELS[status] : (status ?? 'Not specified')
}

export function getPaymentStatusClassName(status?: string | null): string {
  switch (status) {
    case 'paid':
    case 'free':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
    case 'pending_verification':
      return 'bg-sky-500/10 text-sky-700 border-sky-500/20'
    case 'unpaid':
    default:
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20'
  }
}

/** Column shape for inserting into `public.request_payments` (no `recorded_at`). */
export function toRequestPaymentRow(snapshot: RequestPaymentSnapshot): {
  fee_type: string
  fee_amount_min: number | null
  fee_amount_max: number | null
  fee_description: string | null
  amount_paid: number
  payment_method: RequestPaymentMethod
  payment_status: RequestPaymentStatus
  reference_number: string | null
} {
  const { recorded_at: _recordedAt, ...row } = snapshot
  return row
}



