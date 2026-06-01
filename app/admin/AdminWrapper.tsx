'use client'

import dynamic from 'next/dynamic'
import type { Event, AuctionRound, Trait } from '@/lib/types'

const AdminDashboard = dynamic(() => import('./AdminDashboard'), { ssr: false })

interface Props {
  event: Event
  traits: Trait[]
  initialRound: AuctionRound | null
}

export default function AdminWrapper(props: Props) {
  return <AdminDashboard {...props} />
}
