type Kind = 'live' | 'draft' | 'ended' | 'archived' | 'expired' | 'open' | 'closed'

interface Props {
  kind: Kind
  children: React.ReactNode
  className?: string
}

const CLASS: Record<Kind, string> = {
  live: 'border-ink bg-leaf text-ink',
  open: 'border-ink bg-leaf text-ink',
  draft: 'border-ink bg-[#eef3f0] text-ink-2',
  expired: 'border-ink bg-[#eef3f0] text-ink-2',
  ended: 'border-muted-outline bg-card text-ink-3',
  closed: 'border-muted-outline bg-card text-ink-3',
  archived: 'border-muted-outline bg-card text-ink-3',
}

/** Staff status pill with a 2px ink outline. `live` and `open` carry the pulsing green dot. */
export default function StatusPill({ kind, children, className }: Props) {
  const dot = kind === 'live' || kind === 'open'
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 px-3 py-[4px] text-[14px] font-semibold ${CLASS[kind]} ${className ?? ''}`}>
      {dot && <span aria-hidden="true" className="gm-live-dot !h-2 !w-2 !bg-leaf-dot !shadow-none" />}
      {children}
    </span>
  )
}
