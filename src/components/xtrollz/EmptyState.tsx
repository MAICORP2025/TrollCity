import { Radio, ArrowRight } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/20 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Radio size={32} className="text-purple-300" />
      </div>
      <h3 className="mt-6 text-lg font-black text-white">No XTrollerz are live right now.</h3>
      <p className="mt-2 max-w-md text-xs text-white/60">
        Check back soon or start your own broadcast. Approved streamers can go live anytime.
      </p>
      <button
        onClick={() => {}}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-black text-white hover:bg-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.35)] transition-colors"
      >
        Start Broadcasting <ArrowRight size={16} />
      </button>
    </div>
  )
}
