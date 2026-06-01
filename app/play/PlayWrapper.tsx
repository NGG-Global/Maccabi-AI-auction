'use client'

import dynamic from 'next/dynamic'

// ssr: false — PlayClient uses localStorage and Supabase browser client
const PlayClient = dynamic(() => import('./PlayClient'), { ssr: false })

export default function PlayWrapper() {
  return <PlayClient />
}
