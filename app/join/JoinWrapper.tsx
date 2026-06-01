'use client'

import dynamic from 'next/dynamic'

const JoinForm = dynamic(() => import('./JoinForm'), { ssr: false })

interface Props {
  eventId: string
  eventSlug: string
}

export default function JoinWrapper(props: Props) {
  return <JoinForm {...props} />
}
