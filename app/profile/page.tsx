import { Suspense } from 'react'
import ProfileWrapper from './ProfileWrapper'

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileWrapper />
    </Suspense>
  )
}
