import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ActivityEvent {
  id: string
  type: 'live' | 'gift' | 'battle' | 'system' | 'tcnn_breaking' | 'tcnn_live' | 'tcnn_article' | string
  message: string
  priority: 'high' | 'medium' | 'low' | 'breaking'
  created_at: string
  duration_minutes?: number
  metadata?: {
    category?: string
    url?: string
    author?: string
    [key: string]: any
  }
}

const useGlobalActivity = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([])

  const normalizeEvent = useCallback((row: any): ActivityEvent => {
    const numericPriority = Number(row?.priority || 1)
    return {
      id: row?.id || `event-${Date.now()}`,
      type: row?.type || 'system',
      message: row?.title || row?.description || 'City update',
      priority: numericPriority >= 3 ? 'breaking' : numericPriority === 2 ? 'high' : 'medium',
      created_at: row?.created_at || new Date().toISOString(),
      duration_minutes: row?.duration_minutes,
      metadata: row?.metadata || {},
    }
  }, [])

  const getEventKey = useCallback((event: ActivityEvent): string => {
    return `${event.type}:${event.message?.trim().toLowerCase()}`
  }, [])

  const dedupeEvents = useCallback((incoming: ActivityEvent[]): ActivityEvent[] => {
    const seen = new Set<string>()
    return incoming.filter((event) => {
      const key = getEventKey(event)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [getEventKey])

  useEffect(() => {
    let mounted = true

    const loadEvents = async () => {
      if (!mounted) return
      const since = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('global_events')
        .select('id,type,title,icon,priority,metadata,created_at,duration_minutes')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!mounted) return
      if (error) {
        setEvents([])
        return
      }

      setEvents(dedupeEvents((data || []).map(normalizeEvent)))
    }

    void loadEvents()

    const channel = supabase
      .channel('global-events-ticker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_events' }, (payload: any) => {
        const event = normalizeEvent(payload.new)
        setEvents((prevEvents) => {
          const filtered = prevEvents.filter((existing) => existing.id !== event.id)
          const next = [event, ...filtered].slice(0, 50)
          return dedupeEvents(next)
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_events' }, (payload: any) => {
        const event = normalizeEvent(payload.new)
        setEvents((prevEvents) => {
          const filtered = prevEvents.filter((existing) => existing.id !== event.id)
          const next = [event, ...filtered].slice(0, 50)
          return dedupeEvents(next)
        })
      })
      .subscribe((status) => {
        if (import.meta.env.DEV && status !== 'SUBSCRIBED') {
          console.debug('[GlobalTicker] global_events status:', status)
        }
      })

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [normalizeEvent])

  return events
}

export default useGlobalActivity