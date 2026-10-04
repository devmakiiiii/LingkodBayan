'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BarangayBoundary } from '@/components/maps/barangay-boundary'
import {
  BARANGAY_BARRETTO_MAX_BOUNDS,
  BARANGAY_BARRETTO_MAX_ZOOM,
  BARANGAY_BARRETTO_MIN_ZOOM,
  BARANGAY_MAP_TILE_ATTRIBUTION,
  BARANGAY_MAP_TILE_URL,
} from '@/lib/barangay-map'

interface ComplaintLocationMapClientProps {
  latitude: number
  longitude: number
  /** Height of the map viewport in pixels. Defaults to 200 (compact preview). */
  height?: number
  /** Allow panning/zooming. Defaults to false (static preview). */
  interactive?: boolean
}

export default function ComplaintLocationMapClient({
  latitude,
  longitude,
  height = 200,
  interactive = false,
}: ComplaintLocationMapClientProps) {
  const position: [number, number] = [latitude, longitude]

  // Fix Leaflet default marker icon (only runs in browser, memoized to prevent re-creation)
  const defaultIcon = useMemo(() => L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41],
    popupAnchor: [1, -34],
  }), [])

  return (
    <MapContainer
      center={position}
      zoom={16}
      minZoom={BARANGAY_BARRETTO_MIN_ZOOM}
      maxZoom={BARANGAY_BARRETTO_MAX_ZOOM}
      maxBounds={BARANGAY_BARRETTO_MAX_BOUNDS}
      maxBoundsViscosity={1}
      style={{ height: `${height}px`, width: '100%' }}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
    >
      <TileLayer
        attribution={BARANGAY_MAP_TILE_ATTRIBUTION}
        url={BARANGAY_MAP_TILE_URL}
      />
      <BarangayBoundary />
      <Marker
        position={position}
        icon={defaultIcon}
      />
    </MapContainer>
  )
}