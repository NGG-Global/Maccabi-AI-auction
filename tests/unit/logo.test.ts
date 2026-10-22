import { describe, expect, it } from 'vitest'
import { checkLogoFile, detectLogoImageType, logoObjectPath, logoPublicUrl, MAX_LOGO_BYTES } from '@/lib/storage/logo'

function bytes(head: number[], length = 32): Uint8Array {
  const out = new Uint8Array(length)
  out.set(head)
  return out
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPG = [0xff, 0xd8, 0xff, 0xe0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]

describe('detectLogoImageType', () => {
  it('recognises PNG, JPEG and WEBP by their signatures', () => {
    expect(detectLogoImageType(bytes(PNG))).toBe('png')
    expect(detectLogoImageType(bytes(JPG))).toBe('jpg')
    expect(detectLogoImageType(bytes(WEBP))).toBe('webp')
  })
  it('rejects SVG, GIF, text and truncated input', () => {
    expect(detectLogoImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(detectLogoImageType(new TextEncoder().encode('GIF89a..............'))).toBeNull()
    expect(detectLogoImageType(bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toBeNull() // RIFF but AVI
    expect(detectLogoImageType(new Uint8Array(4))).toBeNull()
  })
})

describe('checkLogoFile', () => {
  it('accepts a small PNG and rejects empty, oversized and unknown files', () => {
    expect(checkLogoFile(bytes(PNG)).ok).toBe(true)
    expect(checkLogoFile(new Uint8Array(0)).ok).toBe(false)
    expect(checkLogoFile(bytes(PNG, MAX_LOGO_BYTES + 1)).ok).toBe(false)
    expect(checkLogoFile(new TextEncoder().encode('<svg></svg> padding padding')).ok).toBe(false)
  })
})

describe('logo paths and URLs', () => {
  it('stores logos under the room folder with a timestamp', () => {
    expect(logoObjectPath('room-1', 'png', 1700000000000)).toBe('rooms/room-1/logo-1700000000000.png')
  })
  it('builds the public URL and returns null without a path', () => {
    expect(logoPublicUrl('rooms/r/logo-1.png', 'https://x.supabase.co/')).toBe(
      'https://x.supabase.co/storage/v1/object/public/auction-logos/rooms/r/logo-1.png',
    )
    expect(logoPublicUrl(null, 'https://x.supabase.co')).toBeNull()
  })
})
