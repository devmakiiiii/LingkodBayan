'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Spinner } from '@/components/ui/spinner'

export function NavigationLoader() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const link = target?.closest?.('a[href]') as HTMLAnchorElement | null

      if (!link) return

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (link.target === '_blank') return

      const isSamePage = href === pathname
      if (isSamePage) return

      setIsNavigating(true)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  useEffect(() => {
    if (!isNavigating) return

    const timer = window.setTimeout(() => {
      setIsNavigating(false)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [isNavigating, pathname])

  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  if (!isNavigating) return null

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-[#001a4d]/85 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/95 px-8 py-10 shadow-2xl">
        <Image
          src="/lingkod-logo.png"
          alt="LingkodBayan logo"
          width={72}
          height={72}
          className="h-16 w-16 object-contain"
          priority
        />
        <Spinner className="size-8 text-[#28A745]" />
        <p className="text-sm font-medium text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
