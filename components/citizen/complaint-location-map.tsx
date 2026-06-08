'use client'

import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface ComplaintLocationMapProps {
  latitude: number
  longitude: number
}

export function ComplaintLocationMap({ latitude, longitude }: ComplaintLocationMapProps) {
  const position: [number, number] = [latitude, longitude]

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
      <Marker position={position} />
    </MapContainer>
  )
}