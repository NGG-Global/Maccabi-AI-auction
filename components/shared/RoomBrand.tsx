import { logoPublicUrl } from '@/lib/storage/logo'

interface Props {
  title: string
  clientName?: string | null
  logoPath?: string | null
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center'
}

const LOGO_SIZE = { sm: 'h-8', md: 'h-12', lg: 'h-20' }
const TITLE_SIZE = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }

/** Client logo + client name + room title, shared by the projected screen and the phones. */
export default function RoomBrand({ title, clientName, logoPath, size = 'md', align = 'start' }: Props) {
  const url = logoPublicUrl(logoPath)
  return (
    <div className={`flex items-center gap-3 min-w-0 ${align === 'center' ? 'justify-center text-center' : ''}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={clientName || title}
          className={`${LOGO_SIZE[size]} w-auto max-w-[160px] object-contain rounded-md bg-white/90 p-1 shrink-0`}
        />
      )}
      <div className="min-w-0">
        {clientName && <p className="text-slate-500 text-xs truncate">{clientName}</p>}
        <p className={`text-slate-200 font-semibold truncate ${TITLE_SIZE[size]}`}>{title}</p>
      </div>
    </div>
  )
}
