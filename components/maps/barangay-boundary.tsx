'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { BARANGAY_BARRETTO_BOUNDARY } from '@/lib/barangay-map'

/**
 * Draws the Barangay Barretto administrative boundary on the map so every
 * complaint map is visibly scoped to the barangay the system serves.
 *
 * The layer is non-interactive so it never swallows clicks meant for the
 * underlying tile or the location picker. It renders from the bundled GeoJSON
 * shared with `lib/barangay-map.ts`, so the visible outline and the
 * containment guard can never disagree.
 */
export function BarangayBoundary() {
  const map = useMap()

  useEffect(() => {
    const layer = L.geoJSON(
      // The bundled FeatureCollection is valid GeoJSON; cast past Leaflet's
      // `GeoJsonObject` union so this module never depends on `geojson` typings.
      BARANGAY_BARRETTO_BOUNDARY as unknown as Parameters<typeof L.geoJSON>[0],
      {
        interactive: false,
        style: {
          color: '#1d4ed8',
          weight: 2,
          opacity: 0.8,
          fillColor: '#3b82f6',
          fillOpacity: 0.05,
        },
      },
    ).addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map])

  return null
}
