'use client'

import { useEffect, useState } from 'react'
import { getLocale, t as translate, type Locale } from '@/lib/i18n'

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

  const t = (key: string) => translate(key, locale)

  return { locale, t }
}
