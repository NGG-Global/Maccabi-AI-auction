import type { Metadata, Viewport } from 'next'
import { Fredoka, Heebo } from 'next/font/google'
import './globals.css'

// "Board Game" type: Fredoka everywhere (it has Hebrew), Heebo as the fallback.
// See design-kit/DESIGN.md.
const fredoka = Fredoka({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
})

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'המכירה הפומבית — NGG',
  description: 'מכירה פומבית חיה לסדנאות של NGG',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#dff3e9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${fredoka.variable} ${heebo.variable} h-full`}>
      <body className="min-h-full bg-page text-ink antialiased">{children}</body>
    </html>
  )
}
