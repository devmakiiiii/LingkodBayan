'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

// Fix Leaflet default marker icon
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const RedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const YellowIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const GreenIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
})

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return RedIcon
    case 'processing':
      return YellowIcon
    case 'resolved':
      return GreenIcon
    default:
      return DefaultIcon
  }
}

export function ComplaintsAnalyticsMap({ complaints, onMarkerClick }: ComplaintsAnalyticsMapProps) {
  const [heatmapData, setHeatmapData] = useState<[number, number, number][]>([])

  // Generate heatmap data from complaints (lat, lng, intensity)
  useEffect(() => {
    const data = complaints
      .filter((c) => c.latitude && c.longitude)
      .map((c) => [c.latitude, c.longitude, 0.5] as [number, number, number])
    setHeatmapData(data)
  }, [complaints])

  // Calculate center of all complaints
  const center: [number, number] =
    complaints.length > 0 && complaints[0].latitude && complaints[0].longitude
      ? [complaints[0].latitude, complaints[0].longitude]
      : [14.5995, 120.9842] // Manila default

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render complaint markers */}
        {complaints.map(
          (complaint) =>
            complaint.latitude &&
            complaint.longitude && (
              <Marker
                key={complaint.id}
                position={[complaint.latitude, complaint.longitude]}
                icon={getStatusIcon(complaint.status)}
                eventHandlers={{
                  click: () => onMarkerClick?.(complaint),
                }}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-bold">{complaint.subject}</p>
                    <p className="text-gray-600">{complaint.resident_name}</p>
                    <p className="text-gray-500">{complaint.location_address}</p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        complaint.status === 'pending'
                          ? 'bg-red-100 text-red-800'
                          : complaint.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {complaint.status.toUpperCase()}
                    </span>
                  </div>
                </Popup>
              </Marker>
            )
        )}

        {/* Hotspot visualization - circles for density areas */}
        {complaints.slice(0, 5).map((complaint, idx) => (
          complaint.latitude &&
          complaint.longitude && (
            <CircleMarker
              key={`hotspot-${idx}`}
              center={[complaint.latitude, complaint.longitude]}
              radius={30}
              fillColor="#ff6b6b"
              color="#ff0000"
              weight={2}
              opacity={0.3}
              fillOpacity={0.1}
            />
          )
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-md border border-gray-200 z-999">
        <h4 className="font-semibold text-sm mb-2">Status Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Resolved</span>
          </div>
        </div>
      </div>
    </div>
  )
}
