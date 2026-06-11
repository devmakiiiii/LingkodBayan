'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface ComplaintLocationMapClientProps {
  latitude: number
  longitude: number
}

export default function ComplaintLocationMapClient({ latitude, longitude }: ComplaintLocationMapClientProps) {
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
      // @ts-expect-error - react-leaflet types have issues
      center={position}
      zoom={17}
      style={{ height: '200px', width: '100%' }}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
    >
      <TileLayer
        // @ts-expect-error - react-leaflet types have issues
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={position}
        // @ts-expect-error - react-leaflet types have issues
        icon={defaultIcon}
      />
    </MapContainer>
  )
}