import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, Clock } from 'lucide-react'

export default function FoundingOfficerTrial() {
  const [shifts, setShifts] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('officer_shifts')
        .select('id, user_id, shift_start, shift_end, role')
        .order('shift_start', { ascending: true })
      setShifts(data || [])
    }
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0814] text-white px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          Founding Officer Trial
        </h1>

        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-3">
          <div>Trial lasts 14 days</div>
          <div>Officer coverage: 4pm–4am</div>
          <div>Officers and users earn coins, but payouts are locked until trial ends</div>
          <div>Founding Officers earn permanent badges and priority paid roles after trial</div>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
          <div className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" /> Officer Shifts
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-black/40 border border-gray-800 rounded-lg p-4">
              <div className="font-semibold">Shift A</div>
              <div>4pm–10pm</div>
            </div>
            <div className="bg-black/40 border border-gray-800 rounded-lg p-4">
              <div className="font-semibold">Shift B</div>
              <div>10pm–4am</div>
            </div>
          </div>
          {shifts.length > 0 && (
            <div className="space-y-2">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-black/30 border border-gray-800 rounded-lg p-3">
                  <div className="text-sm">Role: {s.role}</div>
                  <div className="text-xs text-gray-300">
                    {s.shift_start ? new Date(s.shift_start).toLocaleString() : ''} → {s.shift_end ? new Date(s.shift_end).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
