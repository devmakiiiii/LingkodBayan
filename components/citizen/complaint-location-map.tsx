'use client'

import dynamic from 'next/dynamic'

interface ComplaintLocationMapProps {
  latitude: number
  longitude: number
}

const ComplaintLocationMapClient = dynamic(
  () => import('./complaint-location-map-client'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
)

export function ComplaintLocationMap({ latitude, longitude }: ComplaintLocationMapProps) {
  return (
    <div className="isolate">
      <ComplaintLocationMapClient latitude={latitude} longitude={longitude} />
    </div>
  )
}
