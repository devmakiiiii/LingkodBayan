'use client'

import dynamic from 'next/dynamic'

interface ComplaintData {
  id: string
  latitude: number
  longitude: number
  location_address: string
  category: string
  subject: string
  created_at: string
  status: string
  resident_name: string
}

interface ComplaintsAnalyticsMapProps {
  complaints: ComplaintData[]
  onMarkerClick?: (complaint: ComplaintData) => void
}

const ComplaintsAnalyticsMapClient = dynamic(
  () => import('./complaints-analytics-map-client'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
)

export function ComplaintsAnalyticsMap({ complaints, onMarkerClick }: ComplaintsAnalyticsMapProps) {
  return <ComplaintsAnalyticsMapClient complaints={complaints} onMarkerClick={onMarkerClick} />
}