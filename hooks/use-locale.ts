'use client'

import { useEffect, useState } from 'react'
import { getLocale, t as translate, LOCALE_HTML_LANG, type Locale } from '@/lib/i18n'

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    // Sync on mount (SSR-safe) and whenever locale changes elsewhere.
    const sync = () => setLocaleState(getLocale())
    sync()
    window.addEventListener('lb-locale-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('lb-locale-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // Keep <html lang> in sync so screen readers announce the right language.
  useEffect(() => {
    document.documentElement.lang = LOCALE_HTML_LANG[locale]
  }, [locale])

  const t = (key: string, params?: Record<string, string | number>) =>
    translate(key, locale, params)

  return { locale, t }
}
