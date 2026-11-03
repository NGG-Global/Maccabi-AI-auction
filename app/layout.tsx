import type { Metadata, Viewport } from 'next'
import { Frank_Ruhl_Libre, IBM_Plex_Sans_Hebrew } from 'next/font/google'
import './globals.css'

// "Evening Sale" type: a heavy Hebrew serif for content (statements,
// numbers, titles) and a clean sans for UI. See design-kit/DESIGN.md.
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '700', '900'],
  variable: '--font-frank',
  display: 'swap',
})

const plex = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ערב מכירה — NGG',
  description: 'מכירה פומבית חיה לסדנאות של NGG',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#160e12',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${plex.variable} h-full`}>
      <body className="min-h-full bg-velvet-1 text-ivory antialiased">{children}</body>
    </html>
  )
}
