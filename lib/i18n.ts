export type Locale = 'en' | 'tl'

const LOCALE_KEY = 'lb-locale'

/**
 * Dictionary keyed by the English string.
 * Missing keys fall back to the key itself.
 */
const dictionary: Record<string, string> = {
  // Navigation & common labels
  Dashboard: 'Dashboard',
  'Request Service': 'Humiling ng Serbisyo',
  'My Requests': 'Ang Aking mga Kahilingan',
  'My Complaints': 'Ang Aking mga Reklamo',
  'File Complaint': 'Magreklamo',
  Announcements: 'Mga Anunsyo',
  Notifications: 'Mga Abiso',
  'Document Pickups': 'Mga Pickup ng Dokumento',
  Offices: 'Mga Opisina',
  Feedback: 'Feedback',
  'Verify ID': 'Beripikahin ang ID',
  'Sign Out': 'Mag-sign Out',
  'Welcome back': 'Maligayang pagbabalik',
  Track: 'Subaybayan',
  Submit: 'Ipasa',
  Cancel: 'Kanselahin',
  Search: 'Maghanap',
  Status: 'Katayuan',
  Pending: 'Nakabinbin',
  Processing: 'Isinasagawa',
  Approved: 'Aprubado',
  Rejected: 'Tinanggihan',
}

export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY)
    return stored === 'tl' ? 'tl' : 'en'
  } catch {
    return 'en'
  }
}

export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

export function t(key: string, locale: Locale): string {
  if (locale === 'en') return key
  return dictionary[key] ?? key
}
