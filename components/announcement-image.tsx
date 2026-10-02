'use client'

import { useState } from 'react'

interface AnnouncementImageProps {
  src: string
  alt: string
  /** Classes applied to the <img> element. */
  className?: string
  /** Classes applied to the wrapper that is dropped when the image fails to load. */
  wrapperClassName?: string
}

/**
 * Announcement cover image with a graceful broken-image fallback.
 *
 * The `onError` handler has to live in a Client Component: announcements are
 * rendered inside Server Components (`/announcements/[id]`,
 * `/citizen/announcements`, `/citizen/announcements/[id]`), and React refuses
 * to serialise event handlers across the server/client boundary. When the image
 * cannot be loaded the wrapper is removed so no empty placeholder box remains.
 */
export function AnnouncementImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  wrapperClassName = 'relative aspect-video bg-gray-100 dark:bg-muted',
}: AnnouncementImageProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return null
  }

  return (
    <div className={wrapperClassName}>
      <img src={src} alt={alt} className={className} onError={() => setHasError(true)} />
    </div>
  )
}