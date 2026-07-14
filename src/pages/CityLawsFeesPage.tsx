import React from 'react'

import CityLawsFeesTab from '@/components/home/CityLawsFeesTab'

export default function CityLawsFeesPage() {
  return (
    <div className="min-h-screen bg-[#050714] px-4 pb-8 pt-24 text-white md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
            <span className="text-xl font-black text-cyan-200">📜</span>
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
              City Laws & Fees
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              City legislation, statutes, fees, and active protests.
            </p>
          </div>
        </div>
        <CityLawsFeesTab />
      </div>
    </div>
  )
}
