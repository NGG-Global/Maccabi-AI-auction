import CoinIcon from '@/components/game/CoinIcon'

/** Full-screen loading state in the board-game language: the mint board, a coin and a thin line. */
export default function LoadingScreen() {
  return (
    <div className="bg-dots fixed inset-0 z-[9999] grid place-items-center" role="status" aria-live="polite" aria-label="טוען">
      <div className="gm-fade flex flex-col items-center gap-5 rounded-[24px] border-[3px] border-ink bg-card px-10 py-8 shadow-piece-md">
        <CoinIcon size={56} />
        <p className="m-0 text-[30px] font-bold leading-none text-ink">המכירה הפומבית</p>
        <div className="skeleton h-1.5 w-44 rounded-full" />
      </div>
    </div>
  )
}
