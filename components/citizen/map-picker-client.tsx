'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BarangayBoundary } from '@/components/maps/barangay-boundary'
import { formatCoordinates, describePickedAddress, type PickedAddress } from '@/lib/address'
import {
  BARANGAY_BARRETTO_CENTER,
  BARANGAY_BARRETTO_DEFAULT_ZOOM,
  BARANGAY_BARRETTO_MAX_BOUNDS,
  BARANGAY_BARRETTO_MAX_ZOOM,
  BARANGAY_BARRETTO_MIN_ZOOM,
  BARANGAY_MAP_TILE_ATTRIBUTION,
  BARANGAY_MAP_TILE_URL,
  isWithinBarangayBarretto,
} from '@/lib/barangay-map'

interface MapPickerClientProps {
  onLocationSelect: (lat: number, lng: number, picked: PickedAddress) => void
}

function MapBoundsSetter() {
  const map = useMap()
  useEffect(() => {
    // Fit the whole barangay on first paint so residents can't start outside it.
    map.fitBounds(BARANGAY_BARRETTO_MAX_BOUNDS, {
      padding: [20, 20],
      maxZoom: BARANGAY_BARRETTO_DEFAULT_ZOOM,
    })
  }, [map])
  return null
}

/** Progress of the reverse-geocode lookup for the current pin. */
type GeocodeState = 'idle' | 'resolving' | 'resolved' | 'unavailable'

interface LocationMarkerProps {
  onLocationSelect: (lat: number, lng: number, picked: PickedAddress) => void
  /** Called with `true` when a click lands outside Barangay Barretto. */
  onOutOfAreaChange: (outOfArea: boolean) => void
  /** Reports whether a readable street address could be found for the pin. */
  onGeocodeStateChange: (state: GeocodeState) => void
}

function LocationMarker({ onLocationSelect, onOutOfAreaChange, onGeocodeStateChange }: LocationMarkerProps) {
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  // Guards against a slow reverse-geocode response overwriting a newer pick.
  const requestRef = useRef(0)

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

  async function reverseGeocode(lat: number, lng: number, requestId: number) {
    const fallback = formatCoordinates(lat, lng)
    const isStale = () => requestRef.current !== requestId
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`,
      )
      if (!response.ok) throw new Error(`reverse geocoding failed with ${response.status}`)
      const data = await response.json()
      const picked = describePickedAddress(data, fallback)
      if (isStale()) return
      setAddress(picked.full)
      onLocationSelect(lat, lng, picked)
      // No street came back — tell the resident to type it instead of
      // silently showing coordinates.
      onGeocodeStateChange(picked.street ? 'resolved' : 'unavailable')
    } catch {
      if (isStale()) return
      const picked = { street: '', localities: fallback, full: fallback }
      setAddress(fallback)
      onLocationSelect(lat, lng, picked)
      onGeocodeStateChange('unavailable')
    }
  }

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      // Complaints must be pinned inside Barangay Barretto, so ignore (and
      // flag) any click that lands in a neighbouring barangay or on the bay.
      if (!isWithinBarangayBarretto(lat, lng)) {
        onOutOfAreaChange(true)
        return
      }
      onOutOfAreaChange(false)
      onGeocodeStateChange('resolving')
      setPosition([lat, lng])
      setAddress(null)
      requestRef.current += 1
      void reverseGeocode(lat, lng, requestRef.current)
    },
  })

  if (position === null) return null

  return (
    <Marker position={position} icon={defaultIcon}>
      <Popup>
        <span className="block max-w-[220px] text-xs leading-snug">
          {address ?? 'Resolving address…'}
        </span>
      </Popup>
    </Marker>
  )
}

export default function MapPickerClient({ onLocationSelect }: MapPickerClientProps) {
  const [outOfArea, setOutOfArea] = useState(false)
  const [geocodeState, setGeocodeState] = useState<GeocodeState>('idle')

  return (
    <div>
      <div className="relative">
        <MapContainer
          center={BARANGAY_BARRETTO_CENTER}
          zoom={BARANGAY_BARRETTO_DEFAULT_ZOOM}
          minZoom={BARANGAY_BARRETTO_MIN_ZOOM}
          maxZoom={BARANGAY_BARRETTO_MAX_ZOOM}
          maxBounds={BARANGAY_BARRETTO_MAX_BOUNDS}
          maxBoundsViscosity={1}
          style={{ height: '250px', width: '100%' }}
        >
          <TileLayer
            attribution={BARANGAY_MAP_TILE_ATTRIBUTION}
            url={BARANGAY_MAP_TILE_URL}
          />
          <BarangayBoundary />
          <MapBoundsSetter />
          <LocationMarker
            onLocationSelect={onLocationSelect}
            onOutOfAreaChange={setOutOfArea}
            onGeocodeStateChange={setGeocodeState}
          />
        </MapContainer>

        {outOfArea && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-[1000] -translate-x-1/2 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-md">
            Please pick a spot inside Barangay Barretto.
          </div>
        )}
      </div>

      {geocodeState === 'unavailable' && (
        <p className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          We couldn&apos;t read a street address at this pin — please type it in the address box below.
        </p>
      )}
    </div>
  )
}