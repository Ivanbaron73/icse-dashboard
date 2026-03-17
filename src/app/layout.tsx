import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ICSE – Dashboard Marketing',
  description: 'Dashboard de marketing en tiempo real – Meta Ads & GoHighLevel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
