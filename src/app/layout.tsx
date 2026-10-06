import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import SWRegister from '@/components/sw-register'
import './globals.css'

export const metadata: Metadata = {
  title: 'DEPos',
  description: 'Sistema de punto de venta DePOS Dosis',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <SWRegister />
      </body>
    </html>
  )
}
