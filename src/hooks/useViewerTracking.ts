import { useEffect, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Enhanced viewer tracking with instant count updates
 * - Immediate count update when viewer joins
 * - Immediate count update when viewer leaves
 * - Heartbeat updates every 30 seconds for activity
 * - Real-time subscriptions for instant sync across all clients
 */
export function useViewerTracking(streamId: string | null, userId: string | null) {
  
  // Function to update viewer count immediately
  const updateViewerCount = useCallback(async () => {
    if (!streamId) return
    
    try {
      // Count active viewers (last seen within 2 minutes)
      const { count, error } = await supabase
        .from('stream_viewers')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId)
        .gt('last_seen', new Date(Date.now() - 120000).toISOString())
      
      if (error) {
        console.error('Error counting viewers:', error)
        return
      }
      
      // Update stream's current_viewers field immediately
      const { error: updateError } = await supabase.rpc('update_viewer_count', {
        p_stream_id: streamId,
        p_count: count || 0
      })
      
      if (updateError) {
        console.error('Error updating stream viewer count:', updateError)
      }
    } catch (error) {
      console.error('Error in updateViewerCount:', error)
    }
  }, [streamId])

  // Track viewer when component mounts
  useEffect(() => {
    if (!streamId || !userId) return

    let mounted = true

    const trackViewer = async () => {
      try {
        // Check if user is already tracked for this stream
        const { data: existing, error: checkError } = await supabase
          .from('stream_viewers')
          .select('id')
          .eq('stream_id', streamId)
          .eq('user_id', userId)
          .maybeSingle()

        if (checkError) {
          console.error('Error checking existing viewer:', checkError)
          return
        }

        if (existing) {
          // User already tracked, just update the timestamp
          const { error: updateError } = await supabase
            .from('stream_viewers')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', existing.id)

          if (updateError) {
            console.error('Error updating viewer timestamp:', updateError)
          }
        } else {
          // Add new viewer - IMMEDIATE COUNT UPDATE
          const { error: insertError } = await supabase
            .from('stream_viewers')
            .insert({
              stream_id: streamId,
              user_id: userId,
              joined_at: new Date().toISOString(),
              last_seen: new Date().toISOString()
            })

          if (insertError) {
            console.error('Error inserting new viewer:', insertError)
          }
          
          // Trigger immediate count update for new viewer
          await updateViewerCount()
        }
      } catch (error) {
        console.error('Error in trackViewer:', error)
      }
    }

    if (mounted) {
      trackViewer()
    }

    // Set up heartbeat interval (every 30 seconds)
    const heartbeatInterval = setInterval(async () => {
      if (!mounted || !streamId || !userId) return
      
      try {
        // Update last_seen for this viewer
        const { error: updateError } = await supabase
          .from('stream_viewers')
          .update({ last_seen: new Date().toISOString() })
          .eq('stream_id', streamId)
          .eq('user_id', userId)

        if (updateError) {
          console.error('Error updating heartbeat:', updateError)
        } else {
          // Optimization: Do NOT update count on every heartbeat.
          // This prevents thundering herd on the DB.
          // Count is updated on Join/Leave. Ghost users will eventually drop off 
          // when a new user joins/leaves and triggers a recount, or via cron.
        }
      } catch (error) {
        console.error('Error in heartbeat:', error)
      }
    }, 30000)

    return () => {
      mounted = false
      clearInterval(heartbeatInterval)
    }
  }, [streamId, userId, updateViewerCount])

  // Cleanup function for when user leaves (call this on unmount)
  useEffect(() => {
    if (!streamId || !userId) return

    let mounted = true

    const cleanup = async () => {
      if (!mounted || !streamId || !userId) return
      
      try {
        // Delete viewer record
        const { error: deleteError } = await supabase
          .from('stream_viewers')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', userId)

        if (deleteError) {
          console.error('Error removing viewer:', deleteError)
          return
        }
        
        // IMMEDIATE COUNT UPDATE after removal
        await updateViewerCount()
      } catch (error) {
        console.error('Error in viewer cleanup:', error)
      }
    }

    // Return cleanup function (will be called on unmount)
    return () => {
      mounted = false
      // Perform async cleanup
      cleanup().catch(err => console.error('Cleanup error:', err))
    }
  }, [streamId, userId, updateViewerCount])

  return null
}

/**
 * Hook to get live viewer count for a stream
 * Subscribes to real-time updates
 */
export function useLiveViewerCount(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!streamId) {
      setViewerCount(0)
      setLoading(false)
      return
    }

    let mounted = true

    // Initial fetch from streams table (more efficient than counting rows)
    const getCount = async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('current_viewers')
          .eq('id', streamId)
          .maybeSingle()

        if (error) {
          console.error('Error getting viewer count:', error)
          return
        }

        if (mounted) {
          setViewerCount(data?.current_viewers || 0)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error in getCount:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getCount()

    // Subscribe to streams table updates for real-time viewer count
    const channel = supabase
      .channel(`viewer-count-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          if (mounted && payload.new && typeof payload.new.current_viewers === 'number') {
            setViewerCount(payload.new.current_viewers)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [streamId])

  return { viewerCount, loading }
}


