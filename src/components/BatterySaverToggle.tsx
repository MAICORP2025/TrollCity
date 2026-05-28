import { useBatterySaver } from '../hooks/useBatterySaver'

const toggleOptions: Array<{ value: 'auto' | 'on' | 'off'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

export default function BatterySaverToggle() {
  const {
    setting,
    setSetting,
    effectiveMode,
    batteryLevel,
    charging,
    saveData,
    isPageHidden,
    isBatterySaverOn,
    shouldReduceAnimations,
  } = useBatterySaver()

  return (
    <div className="rounded-3xl border border-cyan-500/20 bg-slate-950/95 p-4 shadow-[0_20px_80px_rgba(34,211,238,0.10)] backdrop-blur-sm text-sm text-slate-200 max-w-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">Battery Saver</div>
          <div className="mt-1 text-base font-semibold text-white">{effectiveMode === 'ultra' ? 'Ultra Power' : effectiveMode === 'reduced' ? 'Reduced Power' : 'Normal'}</div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${effectiveMode === 'ultra' ? 'bg-fuchsia-500/20 text-fuchsia-200' : effectiveMode === 'reduced' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-800 text-slate-300'}`}>
          {effectiveMode}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {toggleOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${setting === option.value ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:bg-slate-800'}`}
            onClick={() => setSetting(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-[13px] text-slate-400">
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-800 px-2 py-1 bg-slate-950/70">{isBatterySaverOn ? 'Enabled' : 'Disabled'}</span>
          {saveData && <span className="rounded-full border border-cyan-800 px-2 py-1 bg-cyan-500/10 text-cyan-200">Save-Data</span>}
          {isPageHidden && <span className="rounded-full border border-slate-800 px-2 py-1 bg-slate-900 text-slate-400">Hidden tab</span>}
          {shouldReduceAnimations && <span className="rounded-full border border-slate-800 px-2 py-1 bg-slate-900 text-slate-400">Animations reduced</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-2xl bg-slate-900/80 px-3 py-2">Battery: {batteryLevel === null ? 'Unknown' : `${Math.round(batteryLevel * 100)}%`}</div>
          <div className="rounded-2xl bg-slate-900/80 px-3 py-2">Charging: {charging === null ? 'Unknown' : charging ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  )
}
