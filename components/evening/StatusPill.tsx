type Kind = 'live' | 'draft' | 'ended' | 'archived' | 'expired' | 'open' | 'closed'

interface Props {
  kind: Kind
  children: React.ReactNode
  className?: string
}

const CLASS: Record<Kind, string> = {
  live: 'bg-[rgba(255,90,54,.16)] text-[#ffd2c4]',
  open: 'bg-[rgba(255,90,54,.16)] text-[#ffd2c4]',
  draft: 'bg-velvet-3 text-ivory-dim',
  expired: 'bg-velvet-3 text-ivory-dim',
  ended: 'border border-velvet-4 bg-transparent text-ivory-mute',
  closed: 'border border-velvet-4 bg-transparent text-ivory-mute',
  archived: 'border border-velvet-3 bg-transparent text-ivory-mute',
}

/** Staff status pill. `live` and `open` carry the pulsing vermilion dot. */
export default function StatusPill({ kind, children, className }: Props) {
  const dot = kind === 'live' || kind === 'open'
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-[5px] text-[14px] font-semibold ${CLASS[kind]} ${className ?? ''}`}>
      {dot && <span aria-hidden="true" className="ev-live-dot !h-2 !w-2 !shadow-none" />}
      {children}
    </span>
  )
}
