import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'מכירה פומבית — תכונות ניהוליות',
  description: 'משחק פתיחה לסדנת מנהיגות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
