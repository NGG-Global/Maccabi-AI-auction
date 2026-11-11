import { logoPublicUrl } from '@/lib/storage/logo'

interface Props {
  title: string
  clientName?: string | null
  logoPath?: string | null
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center'
  /** Logo only, in a fixed outlined box (the projected screen's corner). */
  logoOnly?: boolean
}

const LOGO_H = { sm: 'h-8', md: 'h-12', lg: 'h-20' }
const TITLE = { sm: 'text-[17px]', md: 'text-[22px]', lg: 'text-[30px]' }

/** Client logo + client name + room title, shared by the projected screen and the phones. */
export default function RoomBrand({ title, clientName, logoPath, size = 'md', align = 'start', logoOnly = false }: Props) {
  const url = logoPublicUrl(logoPath)
  if (logoOnly) {
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={clientName || title} className="h-14 w-auto max-w-[220px] rounded-[14px] border-2 border-ink bg-card object-contain px-3 py-1" />
    ) : null
  }
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'center' ? 'w-full flex-col justify-center text-center' : ''}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={clientName || title} className={`${LOGO_H[size]} w-auto max-w-[160px] shrink-0 rounded-[10px] border-2 border-ink bg-card object-contain p-1`} />
      )}
      <div className="min-w-0">
        <p className={`m-0 font-bold leading-tight text-ink ${TITLE[size]} ${align === 'center' ? '[text-wrap:balance]' : 'truncate'}`}>{title}</p>
        {clientName && <p className={`m-0 text-[14px] text-ink-3 ${align === 'center' ? '[text-wrap:balance]' : 'truncate'}`}>{clientName}</p>}
      </div>
    </div>
  )
}
