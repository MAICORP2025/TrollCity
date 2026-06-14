import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UseBroadcastRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  recordedBlob: Blob | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  uploadRecording: (streamId: string) => Promise<string | null>
  error: string | null
}

export function useBroadcastRecorder(): UseBroadcastRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const uploadToStorage = useCallback(async (streamId: string, blobOverride?: Blob | null): Promise<string | null> => {
    const blob = blobOverride ?? recordedBlob
    if (!blob) {
      toast.error('No recording available to upload')
      return null
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      toast.error('Not authenticated')
      return null
    }

    console.log('[useBroadcastRecorder] Uploading...')
    console.log('[useBroadcastRecorder] filePath:', `${user.id}/${streamId}/`)
    console.log('[useBroadcastRecorder] blob.size:', blob.size, 'blob.type:', blob.type)

    setIsUploading(true)
    try {
      const fileName = `recording_${streamId}_${Date.now()}.webm`
      const filePath = `${user.id}/${streamId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('stream-recordings')
        .upload(filePath, blob, { contentType: 'video/webm', upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('stream-recordings')
        .getPublicUrl(filePath)

      const recordingUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('streams')
        .update({ recording_url: recordingUrl })
        .eq('id', streamId)

      if (updateError) throw updateError

      await supabase
        .from('saved_streams')
        .upsert({
          user_id: user.id,
          stream_id: streamId,
          source: 'manual',
          storage_category: 'broadcast_recording',
          file_size_bytes: blob.size,
        }, { onConflict: 'saved_streams_user_id_stream_id_key' })

      toast.success('Recording saved to your profile')
      return recordingUrl
    } catch (err: any) {
      console.error('[useBroadcastRecorder] Upload failed:', err)
      toast.error(err?.message || 'Failed to upload recording')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [recordedBlob])

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          frameRate: 30,
        } as any,
        audio: true,
      })

      streamRef.current = displayStream
      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'

      const recorder = new MediaRecorder(displayStream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        console.log('[useBroadcastRecorder] Chunk size:', e.data.size)
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        console.log('[useBroadcastRecorder] Blob created:', blob)
        console.log('[useBroadcastRecorder] Blob size:', blob?.size)
        setRecordedBlob(blob)

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }

      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
          setIsRecording(false)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      })

      recorder.start(1000)
      setIsRecording(true)
      startTimeRef.current = Date.now()
      setRecordingDuration(0)

      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err: any) {
      setIsRecording(false)
      if (err.name === 'NotAllowedError') {
        setError('Screen capture permission denied')
      } else {
        setError(err?.message || 'Failed to start recording')
      }
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return null
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        console.log('[useBroadcastRecorder] Blob created:', blob)
        console.log('[useBroadcastRecorder] Blob size:', blob?.size)
        setRecordedBlob(blob)
        setIsRecording(false)

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }

        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  const uploadRecording = useCallback(async (streamId: string): Promise<string | null> => {
    return uploadToStorage(streamId)
  }, [uploadToStorage])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return {
    isRecording,
    isUploading,
    recordingDuration,
    recordedBlob,
    startRecording,
    stopRecording,
    uploadRecording,
    error,
  }
}
