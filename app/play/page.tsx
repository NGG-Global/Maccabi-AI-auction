import { Suspense } from 'react'
import PlayWrapper from './PlayWrapper'
import { PlaySkeleton } from './PlayShell'

export default function PlayPage() {
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <PlayWrapper />
    </Suspense>
  )
}
