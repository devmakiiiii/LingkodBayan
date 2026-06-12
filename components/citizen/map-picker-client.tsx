'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapPickerClientProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
}

const BARANGAY_BARRETTO_BOUNDS: [[number, number], [number, number]] = [
  [14.840, 120.253],
  [14.860, 120.270],
]

const BARANGAY_BARRETTO_CENTER: [number, number] = [14.851, 120.263]

function MapBoundsSetter() {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(BARANGAY_BARRETTO_BOUNDS, { padding: [20, 20] })
  }, [map])
  return null
}

function LocationMarker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<[number, number] | null>(null)

  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    },
  })

  const defaultIcon = useMemo(() =>
    L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      shadowSize: [41, 41],
      iconAnchor: [12, 41],
      shadowAnchor: [12, 41],
      popupAnchor: [1, -34],
    }), [])

  return position === null ? null : (
    <Marker position={position} icon={defaultIcon}>
      <Popup>Complaint Location</Popup>
    </Marker>
  )
}

export default function MapPickerClient({ onLocationSelect }: MapPickerClientProps) {
  const handleLocationSelect = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      )
      const data = await response.json()
      const address = data.address?.road || data.address?.village || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      onLocationSelect(lat, lng, address)
    } catch {
      onLocationSelect(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    }
  }

  return (
    <MapContainer center={BARANGAY_BARRETTO_CENTER} zoom={15} style={{ height: '250px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsSetter />
      <LocationMarker onLocationSelect={handleLocationSelect} />
    </MapContainer>
  )
}