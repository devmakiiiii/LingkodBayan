'use client'

import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapPickerClientProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
}

// Barangay Barretto bounds in [lat, lng] format for Leaflet
const BARANGAY_BARRETTO_BOUNDS: [[number, number], [number, number]] = [
  [14.840, 120.253], // Southwest
  [14.860, 120.270], // Northeast
]

// Center point for Barangay Barretto (14.851°N, 120.263°E)
const BARANGAY_BARRETTO_CENTER: [number, number] = [14.851, 120.263]

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
})

L.Marker.prototype.setIcon(DefaultIcon)

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

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Complaint Location</Popup>
    </Marker>
  )
}

export default function MapPickerClient({ onLocationSelect }: MapPickerClientProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    setSelectedLocation(null)
  }, [])

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng })

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
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <MapContainer center={BARANGAY_BARRETTO_CENTER} zoom={15} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBoundsSetter />
        <LocationMarker onLocationSelect={handleLocationSelect} />
      </MapContainer>
      {selectedLocation && (
        <div className="border-t border-gray-200 bg-blue-50 p-4">
          <p className="text-sm text-gray-700">
            <strong>Selected Location:</strong> {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  )
}