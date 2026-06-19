import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UseBroadcastRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  recordingId: string | null
  startRecording: (streamId: string) => Promise<void>
  stopRecording: () => Promise<string | null>
  error: string | null
}

const BROADCAST_API_BASE = import.meta.env.VITE_BROADCAST_API_URL || 'http://localhost:3002/api'

export function useBroadcastRecorder(): UseBroadcastRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const streamIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = useCallback(async (streamId: string) => {
    try {
      setError(null)
      setIsRecording(true)
      setRecordingDuration(0)
      streamIdRef.current = streamId
      startTimeRef.current = Date.now()

      console.log('[useBroadcastRecorder] Starting room recording for stream:', streamId)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Not authenticated')

      const { data: canRecord, error: checkError } = await supabase.rpc('can_user_record', {
        p_user_id: user.id,
      })

      if (checkError) throw checkError

      if (!canRecord?.can_record) {
        setIsRecording(false)
        if (canRecord?.reason === 'no_plan') {
          toast.error('You need a storage plan to record. Visit the Cloud Storage tab in the Coin Store.')
        } else if (canRecord?.reason === 'storage_full') {
          toast.error('Your storage is full. Upgrade your plan in the Cloud Storage tab.')
        }
        return
      }

      const response = await fetch(`${BROADCAST_API_BASE}/broadcasts/start-streaming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          roomName: streamId,
          broadcasterId: user.id,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to start recording')
      }

      const data = await response.json()
      setRecordingId(data.livekitEgressId)
      toast.success('Recording started — all participants will be captured')

      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

      console.log('[useBroadcastRecorder] Recording started with egress ID:', data.livekitEgressId)

    } catch (err: any) {
      setIsRecording(false)
      setError(err?.message || 'Failed to start recording')
      toast.error(err?.message || 'Failed to start recording')
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingId || !streamIdRef.current) {
      setError('No active recording to stop')
      return null
    }

    try {
      setIsUploading(true)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      console.log('[useBroadcastRecorder] Stopping recording:', recordingId)

      const response = await fetch(`${BROADCAST_API_BASE}/broadcasts/stop-streaming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId: streamIdRef.current }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to stop recording')
      }

      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const fileUrl = `recordings/${streamIdRef.current}/${recordingId}.mp4`

      if (streamIdRef.current) {
        await supabase
          .from('streams')
          .update({ recording_url: fileUrl })
          .eq('id', streamIdRef.current)

        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          await supabase
            .from('saved_streams')
            .upsert({
              user_id: user.id,
              stream_id: streamIdRef.current,
              source: 'auto_egress_recording',
              storage_category: 'broadcast_recording',
              recording_duration: duration,
            }, { onConflict: 'user_id,stream_id' })

          const { data: streamData } = await supabase
            .from('streams')
            .select('title, category')
            .eq('id', streamIdRef.current)
            .maybeSingle()

          await supabase
            .from('broadcast_replays')
            .upsert({
              stream_id: streamIdRef.current,
              user_id: user.id,
              title: streamData?.title || 'Live Stream',
              replay_url: fileUrl,
              duration_seconds: duration,
            }, { onConflict: 'stream_id' })
        }
      }

      setIsRecording(false)
      setRecordingId(null)
      streamIdRef.current = null
      setRecordingDuration(0)

      toast.success('Recording saved!')
      console.log('[useBroadcastRecorder] Recording saved:', fileUrl)

      return fileUrl

    } catch (err: any) {
      setError(err?.message || 'Failed to stop recording')
      toast.error(err?.message || 'Failed to stop recording')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [recordingId])

  return {
    isRecording,
    isUploading,
    recordingDuration,
    recordingId,
    startRecording,
    stopRecording,
    error,
  }
}
