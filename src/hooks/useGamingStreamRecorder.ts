import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface UseGamingStreamRecorderReturn {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  cloudflareUid: string | null
  startRecording: (sourceElement?: HTMLElement | null) => Promise<void>
  stopRecording: () => Promise<void>
  uploadToCloudflare: (streamId: string) => Promise<string | null>
  confirmUpload: (streamId: string, uid: string) => Promise<boolean>
  error: string | null
}

/**
 * useGamingStreamRecorder
 *
 * Records the HytroGaming viewer page and uploads to Cloudflare Stream.
 * Only metadata (cloudflare_recording_id, cloudflare_playback_url) is
 * stored in Supabase — the actual video lives on Cloudflare.
 *
 * Flow:
 * 1. startRecording() — captures the game element via captureStream()
 * 2. stopRecording() — stops capture, chunks are buffered in memory
 * 3. uploadToCloudflare(streamId) — gets a TUS upload URL from the edge
 *    function, then uploads the blob directly to Cloudflare Stream
 * 4. confirmUpload(streamId, uid) — tells the edge function to finalize,
 *    which updates streams table + saved_streams
 */
export function useGamingStreamRecorder(): UseGamingStreamRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [cloudflareUid, setCloudflareUid] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startRecording = useCallback(async (sourceElement?: HTMLElement | null) => {
    try {
      setError(null)
      chunksRef.current = []

      let captureStream: MediaStream

      if (sourceElement && typeof (sourceElement as any).captureStream === 'function') {
        captureStream = (sourceElement as any).captureStream(30)
      } else if (sourceElement && typeof (sourceElement as any).webkitCaptureStream === 'function') {
        captureStream = (sourceElement as any).webkitCaptureStream(30)
      } else {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser', frameRate: 30 } as any,
          audio: true,
        })
      }

      streamRef.current = captureStream

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'

      const recorder = new MediaRecorder(captureStream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }

      const videoTrack = captureStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (timerRef.current) clearInterval(timerRef.current)
          }
        })
      }

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

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return
    }

    mediaRecorderRef.current.stop()
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /**
   * Upload the recorded blob to Cloudflare Stream via the edge function.
   */
  const uploadToCloudflare = useCallback(async (streamId: string): Promise<string | null> => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })

    if (!blob || blob.size === 0) {
      toast.error('No recording to upload')
      return null
    }

    setIsUploading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const edgeUrl = `${supabaseUrl}/functions/v1/upload-to-cloudflare-stream`

      // Step 1: Get a direct upload URL from our edge function
      const initRes = await fetch(`${edgeUrl}?action=getUploadUrl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          streamId,
          fileName: `gaming_${streamId}_${Date.now()}.webm`,
          fileSize: blob.size,
        }),
      })

      if (!initRes.ok) {
        const errText = await initRes.text()
        throw new Error(`Failed to get upload URL: ${errText}`)
      }

      const initData = await initRes.json()
      if (!initData.success) {
        throw new Error(initData.error || 'Failed to get upload URL')
      }

      const { uploadURL, uid } = initData
      setCloudflareUid(uid)

      // Step 2: Upload the blob directly to Cloudflare Stream
      const uploadRes = await fetch(uploadURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Tus-Resumable': '1.0.0',
          'Upload-Length': blob.size.toString(),
          'Upload-Metadata': `source ${btoa('hytrogaming')}`,
        },
        body: blob,
      })

      if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 204) {
        const errText = await uploadRes.text()
        throw new Error(`Cloudflare upload failed: ${uploadRes.status} ${errText}`)
      }

      toast.success('Recording uploaded to Cloudflare')
      return uid
    } catch (err: any) {
      console.error('[useGamingStreamRecorder] Upload failed:', err)
      toast.error(err?.message || 'Failed to upload recording')
      return null
    } finally {
      setIsUploading(false)
    }
  }, [])

  /**
   * Confirm the upload is complete — edge function updates streams table
   * with playback URL and auto-saves to saved_streams.
   */
  const confirmUpload = useCallback(async (streamId: string, uid: string): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const edgeUrl = `${supabaseUrl}/functions/v1/upload-to-cloudflare-stream`

      const res = await fetch(`${edgeUrl}?action=confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ streamId, uid }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Confirm failed: ${errText}`)
      }

      const data = await res.json()
      if (data.success) {
        toast.success('Stream saved to your profile')
        return true
      }
      return false
    } catch (err: any) {
      console.error('[useGamingStreamRecorder] Confirm failed:', err)
      toast.error(err?.message || 'Failed to confirm upload')
      return false
    }
  }, [])

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
    cloudflareUid,
    startRecording,
    stopRecording,
    uploadToCloudflare,
    confirmUpload,
    error,
  }
}
