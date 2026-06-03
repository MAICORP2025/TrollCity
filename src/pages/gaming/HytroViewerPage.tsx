import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import HytroViewerLayoutDesktop from '@/components/gaming/HytroViewerLayoutDesktop'
import HytroViewerLayoutMobile from '@/components/gaming/HytroViewerLayoutMobile'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useGamingStreamRecorder } from '@/hooks/useGamingStreamRecorder'

export default function HytroViewerPage() {
  const { id: streamId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isMobile = useIsMobile()
  const [stream, setStream] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHost, setIsHost] = useState(false)
  const [streamEnded, setStreamEnded] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)

  const {
    isRecording,
    isUploading,
    recordingDuration,
    startRecording,
    stopRecording,
    uploadToCloudflare,
    confirmUpload,
    error: recorderError,
  } = useGamingStreamRecorder()

  useEffect(() => {
    let mounted = true
    const fetchStream = async () => {
      if (!streamId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle()

      if (!mounted) return
      if (error) {
        console.warn('[HytroViewerPage] Failed to fetch stream:', error)
        setStream(null)
      } else {
        setStream(data)
        setIsHost(data?.user_id === user?.id || data?.broadcaster_id === user?.id)
      }
      setLoading(false)
    }

    void fetchStream()
    return () => { mounted = false }
  }, [streamId, user?.id])

  useEffect(() => {
    if (!isHost || !stream || streamEnded) return
    if (isRecording || isUploading) return
    if (stream.status === 'live' || stream.is_live) {
      void startRecording(contentRef.current)
    }
  }, [isHost, stream, streamEnded, isRecording, isUploading, startRecording])

  useEffect(() => {
    if (!streamId) return
    const channel = supabase
      .channel(`hytro-stream-${streamId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${streamId}` }, (payload) => {
        const updated = payload.new as any
        if (updated.status === 'ended' && !streamEnded) {
          setStreamEnded(true)
          setStream((prev) => prev ? { ...prev, ...updated } : updated)
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [streamId, streamEnded])

  const handleStreamEnd = useCallback(async () => {
    if (!streamId || !isHost) return
    if (isRecording) await stopRecording()
    if (!isUploading) {
      const uid = await uploadToCloudflare(streamId)
      if (uid) await confirmUpload(streamId, uid)
    }
    navigate(`/stream-summary/${streamId}`)
  }, [streamId, isHost, isRecording, isUploading, stopRecording, uploadToCloudflare, confirmUpload, navigate])

  useEffect(() => {
    if (streamEnded && isHost) void handleStreamEnd()
  }, [streamEnded, isHost, handleStreamEnd])

  if (loading) return <div className="grid min-h-screen place-items-center">Loading stream...</div>
  if (!stream) return <div className="p-6">Stream not found</div>

  const allowJoinBattle = false

  return (
    <div ref={contentRef} className="relative">
      {isHost && isRecording && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          REC {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
        </div>
      )}
      {isHost && isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            <p className="text-sm font-bold text-white">Uploading to Cloudflare...</p>
            <p className="mt-1 text-xs text-zinc-400">Saving your stream to your profile</p>
          </div>
        </div>
      )}
      {recorderError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-yellow-600/90 px-3 py-2 text-xs text-white">
          Recording: {recorderError}
        </div>
      )}
      {isMobile ? (
        <HytroViewerLayoutMobile stream={stream} currentUser={user} allowJoinBattle={allowJoinBattle} />
      ) : (
        <HytroViewerLayoutDesktop stream={stream} currentUser={user} allowJoinBattle={allowJoinBattle} />
      )}
    </div>
  )
}
