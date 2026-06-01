import { redirect } from 'next/navigation'

// Root redirects to join page for the default test event.
// In production, participants use the full /join?event=:slug URL from QR code.
export default function Home() {
  redirect('/join?event=maccabi-2024')
}
