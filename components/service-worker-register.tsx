'use client'

import { useEffect } from 'react'

/**
 * Registers the PWA service worker (public/sw.js) in production builds.
 * Skipped during development so the dev server always serves fresh code.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .catch((error) => {
          console.error('Service worker registration failed:', error)
        })
    }

    // Register after the page has fully loaded so it never competes with
    // initial asset requests.
    if (document.readyState === 'complete') {
      register()
      return
    }

    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
