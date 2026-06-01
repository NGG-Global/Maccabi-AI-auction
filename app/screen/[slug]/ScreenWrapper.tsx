'use client'

import dynamic from 'next/dynamic'
import type { Event } from '@/lib/types'

const ScreenClient = dynamic(() => import('./ScreenClient'), { ssr: false })

export default function ScreenWrapper({ event }: { event: Event }) {
  return <ScreenClient event={event} />
}
