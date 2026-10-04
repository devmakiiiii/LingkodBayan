'use client'

import dynamic from 'next/dynamic'

interface ComplaintLocationMapProps {
  latitude: number
  longitude: number
  /** Height of the map viewport in pixels. Defaults to 200 (compact preview). */
  height?: number
  /** Allow panning/zooming. Defaults to false (static preview). */
  interactive?: boolean
}

const ComplaintLocationMapClient = dynamic(
  () => import('./complaint-location-map-client'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-gray-50 dark:bg-muted rounded-lg border border-gray-200 dark:border-border flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
)

export function ComplaintLocationMap({
  latitude,
  longitude,
  height = 200,
  interactive = false,
}: ComplaintLocationMapProps) {
  return (
    <div className="isolate">
      <ComplaintLocationMapClient
        latitude={latitude}
        longitude={longitude}
        height={height}
        interactive={interactive}
      />
    </div>
  )
}
