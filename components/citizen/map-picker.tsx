'use client'

import dynamic from 'next/dynamic'

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
  initialLat?: number
  initialLng?: number
}

const MapPickerClient = dynamic(() => import('./map-picker-client'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-muted-foreground shadow-sm">
      Loading map...
    </div>
  ),
})

export function MapPicker({ onLocationSelect, initialLat = 14.5995, initialLng = 120.9842 }: MapPickerProps) {
  return (
    <MapPickerClient
      onLocationSelect={onLocationSelect}
      initialLat={initialLat}
      initialLng={initialLng}
    />
  )
}
