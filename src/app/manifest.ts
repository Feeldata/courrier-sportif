import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Courrier Sportif',
    short_name: 'Courrier Sportif',
    description: 'Football camerounais, compétitions, matchs, clubs et joueurs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#edf2ef',
    theme_color: '#0f5a37',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
