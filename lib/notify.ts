/**
 * Unified resident notification helper (server only).
 *
 * Every resident-facing event should go through `notifyResidentByUserId`:
 * it writes the in-app notification and, for SMS-eligible event types,
 * also sends a text message to the resident's registered mobile number.
 *
 * Fail-open contract: a notification or SMS failure must never break the
 * caller's transaction, so everything is caught internally.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createUserNotification, type UserNotificationData } from '@/lib/db'
import { SMS_ELIGIBLE_TYPES, sendSms } from '@/lib/sms'
import { tServer, normalizeLocale } from '@/lib/i18n'

export interface NotifyResult {
  inAppQueued: boolean
  smsSent: boolean
}

export async function notifyResidentByUserId(
  userId: string,
  data: Omit<UserNotificationData, 'userId'>,
): Promise<NotifyResult> {
  let inAppQueued = false

  try {
    await createUserNotification({ ...data, userId })
    inAppQueued = true
  } catch (error) {
    console.error('Failed to create in-app notification:', error)
  }

  let smsSent = false
  if (SMS_ELIGIBLE_TYPES.has(data.type)) {
    try {
      const adminClient = createAdminClient()
      const { data: residentRows } = await adminClient
        .from('residents')
        .select('phone, locale')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      const resident = (residentRows ?? [])[0] as { phone?: string | null; locale?: string | null } | undefined
      const phone = resident?.phone

      if (phone) {
        // Translate the SMS text into the resident's language preference;
        // in-app notifications keep the caller's original English copy.
        const smsLocale = normalizeLocale(resident?.locale)
        const result = await sendSms(
          phone,
          tServer(data.title, smsLocale),
          data.body ? tServer(data.body, smsLocale) : null,
        )
        smsSent = result.sent
        if (!result.sent && result.reason !== 'not_configured' && result.reason !== 'no_phone') {
          console.warn(`SMS not delivered for ${data.type}: ${result.reason}`)
        }
      }
    } catch (error) {
      console.error('Failed to send SMS notification:', error)
    }
  }

  return { inAppQueued, smsSent }
}
