import { useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { HowToVideo } from '../types/howToVideos'

export const HOW_TO_VIDEOS_BUCKET = 'how-to-videos'

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'canceled'

export interface UseHowToVideoUploadResult {
  progress: number
  uploadedBytes: number
  status: UploadStatus
  error: string | null
  upload: (params: {
    file: File
    storagePath: string
    onSignedUrl?: (signedUrl: string) => void
  }) => Promise<{ data: { path: string } | null; error: Error | null }>
  resume: () => Promise<void>
  cancel: () => void
  reset: () => void
}

const CHUNK_SIZE = 6 * 1024 * 1024 // 6MB chunks

const VIDEO_EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  m4v: 'video/x-m4v',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  ogv: 'video/ogg',
  '3gp': 'video/3gpp',
  ts: 'video/mp2t',
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

// Resolve a valid video MIME type. Some browsers report an empty type or
// 'application/octet-stream' for video files, which Supabase storage rejects.
export function resolveVideoContentType(file: File): string {
  if (file.type && file.type.startsWith('video/')) {
    return file.type
  }
  const ext = getFileExtension(file.name)
  if (ext && VIDEO_EXT_MIME[ext]) {
    return VIDEO_EXT_MIME[ext]
  }
  return 'video/mp4'
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || Boolean(VIDEO_EXT_MIME[getFileExtension(file.name)])
}

export function useHowToVideoUpload(): UseHowToVideoUploadResult {
  const [progress, setProgress] = useState(0)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<File | null>(null)
  const pathRef = useRef<string | null>(null)
  const offsetRef = useRef<number>(0)
  const canceledRef = useRef<boolean>(false)
  const onSignedUrlRef = useRef<((signedUrl: string) => void) | undefined>(undefined)

  const uploadChunk = useCallback(
    async (file: File, storagePath: string, start: number, end: number, contentType: string): Promise<void> => {
      const blob = file.slice(start, end)

      // Obtain a fresh signed upload URL for the chunk (resumable / retry-safe).
      const { data: signed, error: signedError } = await supabase.storage
        .from(HOW_TO_VIDEOS_BUCKET)
        .createSignedUploadUrl(storagePath)

      if (signedError || !signed) {
        throw new Error(signedError?.message || 'Failed to create signed upload URL')
      }

      if (onSignedUrlRef.current) onSignedUrlRef.current(signed.signedUrl)

      const { error: uploadError } = await supabase.storage
        .from(HOW_TO_VIDEOS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, blob, {
          contentType,
          upsert: true,
          onUploadProgress: (event: { loaded: number; total: number }) => {
            if (canceledRef.current) return
            const loadedThisChunk = Math.min(event.loaded, end - start)
            const totalLoaded = start + loadedThisChunk
            offsetRef.current = totalLoaded
            setUploadedBytes(totalLoaded)
            setProgress(Math.min(100, Math.round((totalLoaded / file.size) * 100)))
          },
        } as any)

      if (uploadError) {
        throw new Error(uploadError.message || 'Chunk upload failed')
      }
    },
    []
  )

  const runUpload = useCallback(
    async (file: File, storagePath: string) => {
      canceledRef.current = false
      abortRef.current = new AbortController()
      setStatus('uploading')
      setError(null)

      const contentType = resolveVideoContentType(file)

      try {
        const total = file.size
        let offset = offsetRef.current

        while (offset < total) {
          if (canceledRef.current) {
            setStatus('canceled')
            return
          }

          const end = Math.min(offset + CHUNK_SIZE, total)
          await uploadChunk(file, storagePath, offset, end, contentType)
          offset = offsetRef.current
        }

        if (canceledRef.current) {
          setStatus('canceled')
          return
        }

        setProgress(100)
        setStatus('success')
        return { data: { path: storagePath }, error: null }
      } catch (err: any) {
        if (canceledRef.current) {
          setStatus('canceled')
          return
        }
        setError(err?.message || 'Upload failed')
        setStatus('error')
        return { data: null, error: err as Error }
      }
    },
    [uploadChunk]
  )

  const upload = useCallback(
    async (params: {
      file: File
      storagePath: string
      onSignedUrl?: (signedUrl: string) => void
    }) => {
      if (!isVideoFile(params.file)) {
        setError('Unsupported file type. Only video files are allowed.')
        setStatus('error')
        return { data: null, error: new Error('Unsupported file type') }
      }

      if (params.file.size > 1024 * 1024 * 1024) {
        setError('File exceeds the 1GB limit.')
        setStatus('error')
        return { data: null, error: new Error('File too large') }
      }

      fileRef.current = params.file
      pathRef.current = params.storagePath
      offsetRef.current = 0
      setUploadedBytes(0)
      setProgress(0)
      onSignedUrlRef.current = params.onSignedUrl

      return (await runUpload(params.file, params.storagePath)) as {
        data: { path: string } | null
        error: Error | null
      }
    },
    [runUpload]
  )

  const resume = useCallback(async () => {
    if (!fileRef.current || !pathRef.current) return
    await runUpload(fileRef.current, pathRef.current)
  }, [runUpload])

  const cancel = useCallback(() => {
    canceledRef.current = true
    abortRef.current?.abort()
    setStatus('canceled')
  }, [])

  const reset = useCallback(() => {
    canceledRef.current = false
    abortRef.current?.abort()
    fileRef.current = null
    pathRef.current = null
    offsetRef.current = 0
    setUploadedBytes(0)
    setProgress(0)
    setStatus('idle')
    setError(null)
  }, [])

  return { progress, uploadedBytes, status, error, upload, resume, cancel, reset }
}

// Helper used by admin components to build a storage path for a video file.
export function buildHowToVideoStoragePath(fileName: string, userId?: string | null): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${userId ? `${userId}/` : ''}${unique}-${safeName}`
}

// Extract a thumbnail (first frame) data URL from a video File using a video element.
export function extractVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, video.duration || 0)
      } catch {
        resolve(null)
      }
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 180
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    video.src = url
  })
}

export type { HowToVideo }
