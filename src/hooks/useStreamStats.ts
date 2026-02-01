import { useEffect, useState } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import { supabase } from '../lib/supabase'

export function useStreamStats(room: Room | null, streamerId: string | null) {
  const [viewerCount, setViewerCount] = useState(1)
  const [duration, setDuration] = useState('00:00:00')
  const [streamerStats, setStreamerStats] = useState<any>(null)

  // Live timer
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      const diff = Date.now() - start
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDuration(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Viewer count from LiveKit
  useEffect(() => {
    if (!room) return

    const updateViewers = () => {
      // Count remote participants (viewers) + local participant
      const count = room.remoteParticipants.size + (room.localParticipant ? 1 : 0)
      setViewerCount(Math.max(1, count)) // At least 1 (the streamer)
    }

    // Initial update
    updateViewers()

    // Listen to participant events
    const handleParticipantConnected = () => updateViewers()
    const handleParticipantDisconnected = () => updateViewers()

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected)
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
    }
  }, [room])

  // Fetch streamer stats (coins, level, badge)
  useEffect(() => {
    if (!streamerId) return

    const fetchStreamerStats = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('username, level, total_earned_coins, troll_coins, troll_coins')
          .eq('id', streamerId)
          .single()

        if (data) {
          setStreamerStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch streamer stats:', error)
      }
    }

    fetchStreamerStats()
    
    // Subscribe to real-time updates instead of polling
    const channel = supabase
      .channel(`streamer_stats_${streamerId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_profiles', 
          filter: `id=eq.${streamerId}` 
        },
        (payload) => {
          if (payload.new) {
            // Merge new data with existing stats
            setStreamerStats((prev: any) => ({
              ...prev,
              ...payload.new
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamerId])

  return { viewerCount, duration, streamerStats }
}

