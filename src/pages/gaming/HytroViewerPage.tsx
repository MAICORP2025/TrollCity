import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import HytroViewerLayoutDesktop from '@/components/gaming/HytroViewerLayoutDesktop'
import HytroViewerLayoutMobile from '@/components/gaming/HytroViewerLayoutMobile'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useBroadcastRealtime } from '@/hooks/useBroadcastRealtime'
import { useGamingStreamRecorder } from '@/hooks/useGamingStreamRecorder'

export default function HytroViewerPage() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isMobile = useIsMobile()
  const [initialStream, setInitialStream] = useState<any | null>(null)
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

  const realtime = useBroadcastRealtime({
    streamId: streamId || '',
    userId: user?.id,
    initialStream,
    onStreamEnd: () => {
      setStreamEnded(true)
    },
  })

  const stream = realtime.stream || initialStream
  const isStreamLoading = loading || realtime.isLoading

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
        setInitialStream(null)
      } else {
        setInitialStream(data)
        setIsHost(data?.user_id === user?.id || data?.broadcaster_id === user?.id)
      }
      setLoading(false)
    }

    void fetchStream()
    return () => { mounted = false }
  }, [streamId, user?.id])

  useEffect(() => {
    console.log('[HytroViewerPage] render check', { streamId, initialStream })
  }, [streamId, initialStream])

  useEffect(() => {
    if (!stream) return
    setIsHost(stream.user_id === user?.id || stream.broadcaster_id === user?.id)
  }, [stream, user?.id])

  useEffect(() => {
    if (!isHost || !stream || streamEnded) return
    if (isRecording || isUploading) return
    if (stream.status === 'live' || stream.is_live) {
      void startRecording(contentRef.current)
    }
  }, [isHost, stream, streamEnded, isRecording, isUploading, startRecording])

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

  if (isStreamLoading) return <div className="grid min-h-screen place-items-center">Loading stream...</div>
  if (!stream) return <div className="p-6">Stream not found</div>

  const allowJoinBattle = false
  // Only show "stream ended" overlay when onStreamEnd fires (live → ended transition).
  // Don't use realtime.hasEnded because that reflects the DB status which may be stale.
  const hasEnded = streamEnded

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
      {hasEnded && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-red-500"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Live Stream Ended</h2>
          <p className="text-zinc-400 mb-8">This broadcast has ended. Thanks for watching!</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/live')} className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-full">
              Go to Live
            </button>
            <button onClick={() => navigate('/home', { replace: true })} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full">
              Go Home
            </button>
          </div>
        </div>
      )}
      {isMobile ? (
        <HytroViewerLayoutMobile stream={stream} currentUser={user} allowJoinBattle={allowJoinBattle} hasEnded={hasEnded} />
      ) : (
        <HytroViewerLayoutDesktop stream={stream} currentUser={user} allowJoinBattle={allowJoinBattle} hasEnded={hasEnded} />
      )}
    </div>
  )
}
