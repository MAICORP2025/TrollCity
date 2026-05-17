import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Church } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

type DailyWord = {
  id: string
  title?: string | null
  passage?: string | null
  scripture?: string | null
  verse_reference?: string | null
  daily_date?: string | null
  created_at?: string | null
}

export default function DailyChurchNotification() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return

    const enabled = profile.church_notifications_enabled !== false
    if (!enabled) return

    let cancelled = false

    const loadDailyWordAndNotify = async () => {
      const today = new Date().toISOString().split('T')[0]
      const lastSeenKey = `last_church_daily_word_notification_${today}`

      if (localStorage.getItem(lastSeenKey) === 'seen') return

      try {
        const { data, error } = await supabase
          .from('troll_church_daily_words')
          .select('id, title, passage, scripture, verse_reference, daily_date, created_at')
          .eq('daily_date', today)
          .maybeSingle()

        if (error) throw error
        if (cancelled) return

        if (!data) return

        const dailyWord = data as DailyWord

        const title =
          dailyWord.title ||
          dailyWord.verse_reference ||
          'Daily Word'

        const passage =
          dailyWord.passage ||
          dailyWord.scripture ||
          'Today’s passage is ready. Come pray at Troll Church.'

        toast.custom(
          (id) => (
            <div className="w-full max-w-sm rounded-2xl border border-cyan-400/20 bg-slate-950/95 p-4 text-white shadow-[0_0_35px_rgba(34,211,238,0.2)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
                  <BookOpen size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Church size={14} className="text-cyan-300" />
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                      Troll Church Daily Word
                    </p>
                  </div>

                  <p className="font-black text-white">{title}</p>

                  <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-300">
                    {passage}
                  </p>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        toast.dismiss(id)
                        navigate('/church')
                      }}
                      className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
                    >
                      Read Full Word
                    </button>

                    <button
                      onClick={() => toast.dismiss(id)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ),
          {
            duration: 12000,
            position: 'top-right',
            style: {
              background: 'transparent',
              border: 'none',
              padding: 0,
              boxShadow: 'none',
            },
          }
        )

        localStorage.setItem(lastSeenKey, 'seen')
      } catch (error) {
        console.error('Daily church notification failed:', error)
      }
    }

    const timer = window.setTimeout(loadDailyWordAndNotify, 3000)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [profile, navigate])

  return null
}