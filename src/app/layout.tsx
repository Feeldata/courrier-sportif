import type { Metadata, Viewport } from 'next'

import { AppShell } from '@/components/app'
import { PwaRegister } from '@/components/pwa-register'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Courrier Sportif',
    template: '%s | Courrier Sportif',
  },
  description: 'Le football camerounais : compétitions, matchs, clubs et joueurs.',
  applicationName: 'Courrier Sportif',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f5a37',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
