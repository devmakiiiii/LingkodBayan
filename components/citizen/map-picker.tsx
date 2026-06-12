'use client'

import dynamic from 'next/dynamic'

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
}

const MapPickerClient = dynamic(() => import('./map-picker-client'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-lg border border-gray-200 bg-gray-50 text-center text-sm text-muted-foreground shadow-sm" style={{ height: '250px' }}>
      Loading map...
    </div>
  ),
})

export function MapPicker({ onLocationSelect }: MapPickerProps) {
  return (
    <MapPickerClient
      onLocationSelect={onLocationSelect}
    />
  )
}