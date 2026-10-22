// One-time setup: creates the public Storage bucket that holds client logos.
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run create-logo-bucket
//
// Uses the Storage API (not SQL) on purpose: storage.buckets lives outside
// the `auction` schema and this app never writes to other schemas.
// Safe to re-run: an existing bucket is left as it is.
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'auction-logos'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
if (listErr) {
  console.error('Could not list buckets:', listErr.message)
  process.exit(1)
}
if (buckets.some(b => b.name === BUCKET)) {
  console.log(`Bucket "${BUCKET}" already exists.`)
  process.exit(0)
}
const { error } = await supabase.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: 2 * 1024 * 1024,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
})
if (error) {
  console.error('Could not create bucket:', error.message)
  process.exit(1)
}
console.log(`Bucket "${BUCKET}" created (public read, 2MB, PNG/JPG/WEBP).`)
