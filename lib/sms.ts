/**
 * SMS notifications (server only).
 *
 * Many residents in far-flung puroks have basic feature phones but no
 * smartphone or data plan, so important events are also sent as text
 * messages through the Semaphore gateway (a common Philippine provider).
 *
 * The module fails open: when SEMAPHORE_API_KEY is not configured, SMS is
 * silently skipped and only the in-app notification is created. A gateway
 * outage must never fail the underlying business transaction.
 */

const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages'

/** SMS body cap: keep it comfortably inside a single segment (160 chars). */
const SMS_MAX_LENGTH = 160

export const SMS_ELIGIBLE_TYPES: ReadonlySet<string> = new Set([
  'proxy_granted',
  'proxy_revoked',
  'proxy_request_filed',
  'document_pickup_registered',
  'document_ready_for_pickup',
  'document_claimed',
  'verification_approved',
  'verification_rejected',
])

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SEMAPHORE_API_KEY)
}

/**
 * Normalizes Philippine mobile numbers to the international format the
 * gateway expects: 09171234567, 639171234567, +63 917 123 4567 and
 * (917) 123-4567 all become +639171234567. Landlines and garbage return null.
 */
export function normalizePhoneNumber(raw?: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')

  // 09XX XXXXXXX (11 digits) -> drop the leading 0, add +63
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+63${digits.slice(1)}`
  }
  // 9XX XXXXXXX (10 digits, missing the 0) -> add +63
  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`
  }
  // 639XX XXXXXXX already international
  if (digits.length === 12 && digits.startsWith('63')) {
    return `+${digits}`
  }

  return null
}

/** One-segment SMS body: "LingkodBayan: <title>. <body>" when it fits. */
export function formatSmsMessage(title: string, body?: string | null): string {
  const prefix = 'LingkodBayan: '
  const joined = body ? `${title}. ${body}` : title
  if ((prefix + joined).length <= SMS_MAX_LENGTH) {
    return prefix + joined
  }
  const budget = SMS_MAX_LENGTH - prefix.length
  return prefix + (joined.length > budget ? `${joined.slice(0, budget - 1)}…` : joined)
}

export interface SmsSendResult {
  sent: boolean
  /** 'not_configured' | 'invalid_number' | 'no_phone' | 'gateway_error' | null */
  reason?: string
}

/**
 * Sends one SMS. Never throws — callers treat notification failures as
 * best-effort so the primary transaction is unaffected.
 */
export async function sendSms(rawPhone: string | null | undefined, title: string, body?: string | null): Promise<SmsSendResult> {
  if (!isSmsConfigured()) {
    return { sent: false, reason: 'not_configured' }
  }

  const phone = normalizePhoneNumber(rawPhone)
  if (!phone) {
    return { sent: false, reason: 'invalid_number' }
  }

  try {
    const response = await fetch(SEMAPHORE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.SEMAPHORE_API_KEY,
        number: phone,
        message: formatSmsMessage(title, body),
        sendername: process.env.SEMAPHORE_SENDERNAME || 'LingkodBayan',
      }),
    })

    if (!response.ok) {
      console.error('SMS gateway error:', response.status, await response.text().catch(() => ''))
      return { sent: false, reason: 'gateway_error' }
    }
    return { sent: true }
  } catch (error) {
    console.error('Failed to send SMS:', error)
    return { sent: false, reason: 'gateway_error' }
  }
}
