'use client'

import dynamic from 'next/dynamic'

const ProfileClient = dynamic(() => import('./ProfileClient'), { ssr: false })

export default function ProfileWrapper() {
  return <ProfileClient />
}
