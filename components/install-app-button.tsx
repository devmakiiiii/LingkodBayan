'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Non-standard Chromium event fired before the PWA install prompt is shown.
 * Not present in lib.dom, hence the local interface.
 * See https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/**
 * CTA button that installs the PWA when the browser supports it
 * (Android/Chrome) and falls back to "Get Started" → sign-up everywhere
 * else (iOS Safari, desktop, prompt not yet available, or already installed).
 */
export function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        // iOS Safari exposes navigator.standalone when added to home screen.
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )

    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress the browser's mini-infobar; this button is the CTA instead.
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setInstallEvent(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      // The event is consumed by prompt() and cannot be reused, so clear it
      // either way; Chrome fires beforeinstallprompt again when eligible.
      if (choice.outcome !== 'accepted') {
        setInstallEvent(null)
      }
    } catch {
      setInstallEvent(null)
    }
  }

  const canInstall = installEvent !== null && !isStandalone

  if (canInstall) {
    return (
      <Button
        size="lg"
        onClick={handleInstall}
        className="bg-white dark:bg-card text-[#001a4d] hover:bg-gray-100 dark:bg-muted"
      >
        Install App
      </Button>
    )
  }

  return (
    <Link href="/auth/sign-up" className="inline-block">
      <Button size="lg" className="bg-white dark:bg-card text-[#001a4d] hover:bg-gray-100 dark:bg-muted">
        Get Started
      </Button>
    </Link>
  )
}
