import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UsePodcastRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  recordingId: string | null
  startRecording: (podcastId: string, channelName: string) => Promise<void>
  stopRecording: () => Promise<string | null>
  error: string | null
}

/**
 * usePodcastRecorder — Agora Cloud Recording for Podcast Rooms
 * 
 * Records ALL participants' audio in an Agora podcast channel
 * using Agora's server-side Cloud Recording API.
 * 
 * Flow:
 * 1. startRecording(podcastId, channelName) → calls edge function → Agora starts recording
 * 2. stopRecording() → calls edge function → Agora stops, returns file URL
 * 3. Recording is saved to podcast record and user's profile
 */
export function usePodcastRecorder(): UsePodcastRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const podcastIdRef = useRef<string | null>(null)
  const channelNameRef = useRef<string | null>(null)
  const resourceIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = useCallback(async (podcastId: string, channelName: string) => {
    try {
      setError(null)
      setIsRecording(true)
      setRecordingDuration(0)
      podcastIdRef.current = podcastId
      channelNameRef.current = channelName
      startTimeRef.current = Date.now()

      console.log('[usePodcastRecorder] Starting recording for podcast:', podcastId, 'channel:', channelName)

      const { data, error: fnError } = await supabase.functions.invoke('start-podcast-recording', {
        body: {
          podcast_id: podcastId,
          channel_name: channelName,
        },
      })

      if (fnError) {
        throw new Error(fnError.message || 'Failed to start podcast recording')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setRecordingId(data.recording_id)
      resourceIdRef.current = data.resource_id
      toast.success('Podcast recording started — all participants will be captured')

      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

      console.log('[usePodcastRecorder] Recording started with ID:', data.recording_id)

    } catch (err: any) {
      setIsRecording(false)
      setError(err?.message || 'Failed to start recording')
      toast.error(err?.message || 'Failed to start podcast recording')
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingId || !resourceIdRef.current || !channelNameRef.current) {
      setError('No active recording to stop')
      return null
    }

    try {
      setIsUploading(true)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      console.log('[usePodcastRecorder] Stopping recording:', recordingId)

      const { data, error: fnError } = await supabase.functions.invoke('stop-podcast-recording', {
        body: {
          recording_id: recordingId,
          resource_id: resourceIdRef.current,
          channel_name: channelNameRef.current,
          podcast_id: podcastIdRef.current,
        },
      })

      if (fnError) {
        throw new Error(fnError.message || 'Failed to stop podcast recording')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      const fileUrl = data.file_url

      // Save recording URL as a podcast episode
      if (fileUrl && podcastIdRef.current) {
        await supabase
          .from('podcast_episodes')
          .insert({
            podcast_id: podcastIdRef.current,
            title: 'Recording',
            audio_url: fileUrl,
            duration_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            recorded_at: new Date().toISOString(),
          })

        // Also save to saved_streams for the user's profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          await supabase
            .from('saved_streams')
            .upsert({
              user_id: user.id,
              stream_id: podcastIdRef.current,
              source: 'auto_podcast_recording',
              storage_category: 'podcast_recording',
            }, { onConflict: 'saved_streams_user_id_stream_id_key' })
        }
      }

      // Reset state
      setIsRecording(false)
      setRecordingId(null)
      podcastIdRef.current = null
      channelNameRef.current = null
      resourceIdRef.current = null
      setRecordingDuration(0)

      toast.success('Podcast recording saved!')
      console.log('[usePodcastRecorder] Recording saved:', fileUrl)

      return fileUrl

    } catch (err: any) {
      setError(err?.message || 'Failed to stop recording')
      toast.error(err?.message || 'Failed to stop podcast recording')
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
