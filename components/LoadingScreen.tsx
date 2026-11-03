import CoinIcon from '@/components/evening/CoinIcon'

/** Full-screen loading state in the Evening Sale language: velvet ground, a coin and a thin line. */
export default function LoadingScreen() {
  return (
    <div className="stage-atmos fixed inset-0 z-[9999] grid place-items-center" role="status" aria-live="polite" aria-label="טוען">
      <div className="ev-fade flex flex-col items-center gap-6">
        <CoinIcon size={56} className="drop-shadow-[0_10px_24px_rgba(0,0,0,.5)]" />
        <p className="m-0 font-display text-[34px] font-black leading-none text-ivory">ערב מכירה</p>
        <div className="skeleton h-1 w-44 rounded-full" />
      </div>
    </div>
  )
}
