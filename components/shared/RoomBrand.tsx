import { logoPublicUrl } from '@/lib/storage/logo'

interface Props {
  title: string
  clientName?: string | null
  logoPath?: string | null
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center'
  /** Logo only, in a fixed box (the projected screen's corner). */
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
      <img src={url} alt={clientName || title} className="h-14 w-auto max-w-[220px] rounded-[8px] bg-ivory object-contain p-1" />
    ) : null
  }
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'center' ? 'flex-col justify-center text-center' : ''}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={clientName || title} className={`${LOGO_H[size]} w-auto max-w-[160px] shrink-0 rounded-[8px] bg-ivory object-contain p-1`} />
      )}
      <div className="min-w-0">
        <p className={`m-0 truncate font-display font-bold leading-tight text-ivory ${TITLE[size]}`}>{title}</p>
        {clientName && <p className="m-0 truncate text-[14px] text-ivory-mute">{clientName}</p>}
      </div>
    </div>
  )
}
