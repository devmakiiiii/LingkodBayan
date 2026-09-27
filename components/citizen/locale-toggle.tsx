'use client'

import { useEffect, useState } from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLocale, setLocale, type Locale } from '@/lib/i18n'

export function LocaleToggle() {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    setLocaleState(getLocale())
  }, [])

  function toggle() {
    const next: Locale = locale === 'en' ? 'tl' : 'en'
    setLocale(next)
    setLocaleState(next)
    window.dispatchEvent(new CustomEvent('lb-locale-changed'))
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-label="Toggle language / Palitan ang wika">
      <Languages className="h-4 w-4" aria-hidden="true" />
      {locale === 'en' ? 'EN' : 'TL'}
    </Button>
  )
}
