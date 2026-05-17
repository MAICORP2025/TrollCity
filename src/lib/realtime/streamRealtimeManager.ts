import { supabase } from '../supabase'

type StreamRealtimeTable = 'streams' | 'stream_messages' | 'stream_gifts' | 'stream_participants' | 'battle_sessions'
type StreamRealtimeStatus = 'idle' | 'subscribing' | 'subscribed' | 'error' | 'closed'

export interface StreamRealtimeEvent {
  table: StreamRealtimeTable
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  new: any
  old: any
  raw: any
}

type StreamRealtimeHandler = (event: StreamRealtimeEvent) => void

interface StreamEntry {
  streamId: string
  battleId?: string | null
  channel: ReturnType<typeof supabase.channel>
  handlers: Set<StreamRealtimeHandler>
  status: StreamRealtimeStatus
  eventCounts: Record<string, number>
}

const entries = new Map<string, StreamEntry>()

const isDev = () => Boolean((import.meta as any)?.env?.DEV)

function emit(entry: StreamEntry, table: StreamRealtimeTable, payload: any) {
  const eventType = payload.eventType || '*'
  const key = `${table}:${eventType}`
  entry.eventCounts[key] = (entry.eventCounts[key] || 0) + 1
  const event: StreamRealtimeEvent = {
    table,
    eventType,
    new: payload.new,
    old: payload.old,
    raw: payload,
  }
  entry.handlers.forEach((handler) => {
    try {
      handler(event)
    } catch (error) {
      if (isDev()) console.warn('[streamRealtimeManager] handler failed', error)
    }
  })
}

function createEntry(streamId: string, battleId?: string | null): StreamEntry {
  const entry: StreamEntry = {
    streamId,
    battleId,
    channel: null as unknown as ReturnType<typeof supabase.channel>,
    handlers: new Set<StreamRealtimeHandler>(),
    status: 'subscribing' as StreamRealtimeStatus,
    eventCounts: {},
  }

  const channel = supabase
    .channel(`stream-realtime:${streamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `id=eq.${streamId}` }, (payload) => emit(entry, 'streams', payload))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_messages', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_messages', payload))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_gifts', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_gifts', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_participants', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_participants', payload))

  entry.channel = channel

  if (battleId) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'battle_sessions', filter: `id=eq.${battleId}` }, (payload) => emit(entry, 'battle_sessions', payload))
  }

  channel.subscribe((status) => {
    entry.status = status === 'SUBSCRIBED' ? 'subscribed' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : entry.status
    if (isDev() && status !== 'SUBSCRIBED') {
      console.debug('[streamRealtimeManager] status', { streamId, battleId, status })
    }
  })

  return entry
}

export function subscribeToStreamRealtime(streamId: string, handler: StreamRealtimeHandler, battleId?: string | null) {
  const key = streamId
  let entry = entries.get(key)
  if (!entry) {
    entry = createEntry(streamId, battleId)
    entries.set(key, entry)
  }

  entry.handlers.add(handler)

  return () => {
    const current = entries.get(key)
    if (!current) return

    current.handlers.delete(handler)
    if (current.handlers.size === 0) {
      current.status = 'closed'
      supabase.removeChannel(current.channel)
      entries.delete(key)
    }
  }
}

export function getStreamRealtimeDebugState() {
  return Array.from(entries.values()).map((entry) => ({
    streamId: entry.streamId,
    battleId: entry.battleId || null,
    status: entry.status,
    handlers: entry.handlers.size,
    tables: entry.battleId
      ? ['streams', 'stream_messages', 'stream_gifts', 'stream_participants', 'battle_sessions']
      : ['streams', 'stream_messages', 'stream_gifts', 'stream_participants'],
    eventCounts: { ...entry.eventCounts },
  }))
}

if (typeof window !== 'undefined' && isDev()) {
  ;(window as any).__TROLLCITY_STREAM_REALTIME__ = {
    getState: getStreamRealtimeDebugState,
  }
}
