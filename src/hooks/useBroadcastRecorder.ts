import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UseBroadcastRecorderOptions {
  useR2?: boolean
}

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

export function useBroadcastRecorder(options?: UseBroadcastRecorderOptions): UseBroadcastRecorderReturn {
  const { useR2 = false } = options || {}
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [r2UploadUrl, setR2UploadUrl] = useState<string | null>(null)
  const [r2Key, setR2Key] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const uploadToR2 = useCallback(async (blob: Blob, streamId: string): Promise<string | null> => {
    setIsUploading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const authToken = sessionData.session?.access_token || ''

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`

      const getUrlResp = await fetch(`${edgeFunctionsUrl}/upload-to-r2?action=getUploadUrl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          streamId,
          userId: (await supabase.auth.getUser()).data.user?.id,
          fileName: `broadcast_${streamId}.webm`,
          fileSize: blob.size,
        }),
      })

      if (!getUrlResp.ok) {
        const errText = await getUrlResp.text()
        throw new Error(`Failed to get R2 upload URL: ${errText}`)
      }

      const getUrlData = await getUrlResp.json()
      if (!getUrlData.success || !getUrlData.uploadUrl) {
        throw new Error(getUrlData.error || 'Failed to get upload URL')
      }

      const uploadResponse = await fetch(getUrlData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/webm',
        },
        body: blob,
      })

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status}`)
      }

      await fetch(`${edgeFunctionsUrl}/upload-to-r2?action=confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          streamId,
          userId: (await supabase.auth.getUser()).data.user?.id,
          key: getUrlData.key,
          publicUrl: getUrlData.publicUrl,
          durationSeconds: Math.floor(recordingDuration),
          fileSize: blob.size,
        }),
      })

      toast.success('Replay saved to your profile')
      return getUrlData.publicUrl
    } catch (err: any) {
      console.error('[useBroadcastRecorder] R2 upload failed:', err)
      toast.error(err?.message || 'Failed to upload replay to R2')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [recordingDuration])

  const uploadToStorage = useCallback(async (streamId: string): Promise<string | null> => {
    const blob = recordedBlob
    if (!blob) {
      toast.error('No recording available to upload')
      return null
    }

    setIsUploading(true)
    try {
      const fileName = `recording_${streamId}_${Date.now()}.webm`
      const filePath = `recordings/${streamId}/${fileName}`

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
          user_id: (await supabase.auth.getUser()).data.user?.id,
          stream_id: streamId,
          source: 'gaming_recording',
        }, { onConflict: 'user_id,stream_id' })

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
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
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
    if (useR2) {
      const blob = recordedBlob
      if (!blob) {
        toast.error('No recording available to upload')
        return null
      }
      return uploadToR2(blob, streamId)
    }
    return uploadToStorage(streamId)
  }, [useR2, recordedBlob, uploadToR2, uploadToStorage])

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
