import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { PreflightStore } from '../lib/preflightStore'
import { useStreamStore } from '../lib/streamStore'

interface UseStreamEndListenerProps {
  streamId: string
  enabled?: boolean
  redirectToSummary?: boolean
}

export function useStreamEndListener({
  streamId,
  enabled = true,
  redirectToSummary = true,
}: UseStreamEndListenerProps) {
  const navigate = useNavigate()
  const { clearTracks } = useStreamStore()

  useEffect(() => {
    if (!enabled || !streamId) return

    const handleStreamEnd = () => {
      PreflightStore.clear()
      clearTracks()
      if (redirectToSummary) {
        navigate(`/broadcast/summary/${streamId}`)
      }
    }

    const channel = supabase
      .channel(`stream-end:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newRecord = payload.new as any

          const isActuallyEnded = newRecord?.status === 'ended' || newRecord?.is_live === false;
          if (!isActuallyEnded) return;

          if (newRecord?.is_live === false && newRecord?.status !== 'ended') return;

          handleStreamEnd();
        }
      )
      .on(
        'broadcast',
        { event: 'stream-ended' },
        (payload) => {
          const { streamId: endedStreamId } = payload.payload || {}
          if (endedStreamId === streamId) {
            handleStreamEnd()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_ended_logs',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          handleStreamEnd()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId, enabled, redirectToSummary, navigate, clearTracks])
}

export function useForceStreamEndRedirect(streamId: string) {
  const navigate = useNavigate()

  const redirectToSummary = (reason?: string) => {
    console.log('[useForceStreamEndRedirect] Forcing redirect to stream summary:', streamId, reason)
    navigate(`/stream-summary/${streamId}`)
  }

  return { redirectToSummary }
}
