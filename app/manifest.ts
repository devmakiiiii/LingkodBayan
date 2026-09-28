import type { MetadataRoute } from 'next'
import { BARANGAY_DISPLAY_NAME } from '@/lib/barangay'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `LingkodBayan - ${BARANGAY_DISPLAY_NAME} Services Portal`,
    short_name: 'LingkodBayan',
    description: `The civic services portal for ${BARANGAY_DISPLAY_NAME} residents.`,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#078805',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
