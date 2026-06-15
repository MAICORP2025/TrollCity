import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UpcomingEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  start_time: string | null
  type: string
  icon: string
  participant_count: number
}

export function useUpcomingEvents(limit = 10) {
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('global_events')
          .select('id, title, description, event_date, start_time, type, icon, participant_count')
          .gte('event_date', now)
          .in('status', ['upcoming', 'live'])
          .order('event_date', { ascending: true })
          .limit(limit)
        if (!mounted) return
        if (error) throw error
        setEvents(data || [])
      } catch {
        // Silently fail
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [limit])

  return { events, loading }
}
