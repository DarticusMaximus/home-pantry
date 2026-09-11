import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Home Pantry',
    short_name: 'Pantry',
    description: 'Mobile-first PWA for tracking home food inventory',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#10b981',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
