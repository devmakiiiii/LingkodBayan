'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function GlobalHotkeys() {
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="Search by name" i]') as HTMLInputElement | null
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }

      if (event.key === 'Escape') {
        const openDialog = document.querySelector('[role="dialog"], [data-state="open"]')
        if (openDialog) {
          const closeButton = openDialog.querySelector('[data-dismiss], [aria-label="Close"], button[type="button"]') as HTMLButtonElement | null
          if (closeButton) {
            closeButton.click()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return null
}
