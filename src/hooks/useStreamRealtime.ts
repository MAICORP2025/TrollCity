import { useEffect, useRef } from 'react'
import { subscribeToStreamRealtime, StreamRealtimeEvent } from '../lib/realtime/streamRealtimeManager'

interface UseStreamRealtimeHandlers {
  onStream?: (event: StreamRealtimeEvent) => void
  onMessage?: (event: StreamRealtimeEvent) => void
  onGift?: (event: StreamRealtimeEvent) => void
  onParticipant?: (event: StreamRealtimeEvent) => void
  onBattle?: (event: StreamRealtimeEvent) => void
}

export function useStreamRealtime(streamId?: string | null, handlers: UseStreamRealtimeHandlers = {}, battleId?: string | null) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!streamId) return

    return subscribeToStreamRealtime(streamId, (event) => {
      const current = handlersRef.current
      switch (event.table) {
        case 'streams':
          current.onStream?.(event)
          break
        case 'stream_messages':
          current.onMessage?.(event)
          break
        case 'stream_gifts':
          current.onGift?.(event)
          break
        case 'stream_participants':
          current.onParticipant?.(event)
          break
        case 'battle_sessions':
          current.onBattle?.(event)
          break
      }
    }, battleId)
  }, [streamId, battleId])
}
