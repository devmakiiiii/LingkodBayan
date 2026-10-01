'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BarangayBoundary } from '@/components/maps/barangay-boundary'
import {
  BARANGAY_BARRETTO_CENTER,
  BARANGAY_BARRETTO_MAX_BOUNDS,
  BARANGAY_BARRETTO_MAX_ZOOM,
  BARANGAY_BARRETTO_MIN_ZOOM,
  BARANGAY_MAP_TILE_ATTRIBUTION,
  BARANGAY_MAP_TILE_URL,
} from '@/lib/barangay-map'

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

interface ComplaintsAnalyticsMapClientProps {
  complaints: ComplaintData[]
  onMarkerClick?: (complaint: ComplaintData) => void
}

/** ~0.002° grid (~200 m) used to group nearby complaints into hotspot circles. */
const HOTSPOT_GRID_FACTOR = 500

function hasCoordinates(complaint: ComplaintData): boolean {
  return (
    Number.isFinite(complaint.latitude) &&
    Number.isFinite(complaint.longitude) &&
    !(complaint.latitude === 0 && complaint.longitude === 0)
  )
}

export default function ComplaintsAnalyticsMapClient({ complaints, onMarkerClick }: ComplaintsAnalyticsMapClientProps) {
  // Fix Leaflet default marker icons (only runs in browser)
  const icons = useMemo(() => ({
    default: L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41],
      popupAnchor: [1, -34],
    }),
    red: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41],
      popupAnchor: [1, -34],
    }),
    yellow: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41],
      popupAnchor: [1, -34],
    }),
    green: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41],
      popupAnchor: [1, -34],
    }),
  }), [])

  function getStatusIcon(status: string) {
    switch (status) {
      case 'pending':
        return icons.red
      case 'processing':
        return icons.yellow
      case 'resolved':
        return icons.green
      default:
        return icons.default
    }
  }

  const locatedComplaints = useMemo(() => complaints.filter(hasCoordinates), [complaints])

  // Group nearby complaints into hotspot cells so repeated reports in the same
  // purok show up as a single, heavier circle instead of overlapping pins.
  const hotspotCells = useMemo(() => {
    const grid = new Map<string, { latitude: number; longitude: number; count: number }>()
    for (const complaint of locatedComplaints) {
      const latitude = Math.round(complaint.latitude * HOTSPOT_GRID_FACTOR) / HOTSPOT_GRID_FACTOR
      const longitude = Math.round(complaint.longitude * HOTSPOT_GRID_FACTOR) / HOTSPOT_GRID_FACTOR
      const key = `${latitude}:${longitude}`
      const cell = grid.get(key)
      if (cell) {
        cell.count += 1
      } else {
        grid.set(key, { latitude, longitude, count: 1 })
      }
    }
    return [...grid.values()].filter((cell) => cell.count >= 2)
  }, [locatedComplaints])

  // Centre on the first pinned complaint, otherwise the barangay itself.
  const center: [number, number] =
    locatedComplaints.length > 0
      ? [locatedComplaints[0].latitude, locatedComplaints[0].longitude]
      : BARANGAY_BARRETTO_CENTER

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border border-gray-200 dark:border-border shadow-sm">
      <MapContainer
        center={center}
        zoom={14}
        minZoom={BARANGAY_BARRETTO_MIN_ZOOM}
        maxZoom={BARANGAY_BARRETTO_MAX_ZOOM}
        maxBounds={BARANGAY_BARRETTO_MAX_BOUNDS}
        maxBoundsViscosity={1}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution={BARANGAY_MAP_TILE_ATTRIBUTION}
          url={BARANGAY_MAP_TILE_URL}
        />
        <BarangayBoundary />

        {/* Hotspot density — one circle per cluster of two or more complaints */}
        {hotspotCells.map((cell) => (
          <CircleMarker
            key={`hotspot-${cell.latitude}:${cell.longitude}`}
            center={[cell.latitude, cell.longitude]}
            radius={Math.min(12 + cell.count * 3, 40)}
            pathOptions={{
              color: '#dc2626',
              weight: 1,
              fillColor: '#f87171',
              fillOpacity: 0.35,
            }}
          />
        ))}

        {/* Render complaint markers */}
        {locatedComplaints.map((complaint) => (
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
                    <p className="text-gray-600 dark:text-muted-foreground">{complaint.resident_name}</p>
                    <p className="text-gray-500 dark:text-muted-foreground">{complaint.location_address}</p>
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
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-card p-4 rounded-lg shadow-md border border-gray-200 dark:border-border">
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