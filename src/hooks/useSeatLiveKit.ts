import { useEffect, useRef, useState } from 'react'

export type SeatLiveKitState =
  | 'idle'
  | 'waiting_approval'
  | 'requesting_permission'
  | 'connecting'
  | 'connected'
  | 'publishing'
  | 'live'
  | 'failed'
  | 'cleanup'

interface UseSeatLiveKitOptions {
  seatRequest?: any | null // shape: { id, stream_id, status, user_id, ... }
  roomName?: string
  identity?: string
  onToken?: (token: string | null) => void
}

export function useSeatLiveKit(options: UseSeatLiveKitOptions = {}) {
  const { seatRequest, roomName, identity, onToken } = options
  const [state, setState] = useState<SeatLiveKitState>('idle')
  const [isConnected, setIsConnected] = useState(false)
  const [hasPublishedTracks, setHasPublishedTracks] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset when seatRequest removed
    if (!seatRequest) {
      setState('idle')
      setIsConnected(false)
      setHasPublishedTracks(false)
      setError(null)
      tokenRef.current = null
      if (abortRef.current) abortRef.current.abort()
      return
    }

    // If seat request is approved, prepare to connect
    if (seatRequest.status === 'approved') {
      setState('requesting_permission')
      setError(null)
      // The consumer should call `connectForSeat()` to initiate token fetch and connection
    }
  }, [seatRequest])

  const connectForSeat = async () => {
    if (!seatRequest || seatRequest.status !== 'approved') {
      setError('Seat not approved')
      setState('failed')
      return null
    }

    setState('connecting')
    setError(null)

    // Request token from backend
    const tokenUrl = (import.meta as any).env?.VITE_BACKEND_TOKEN_SERVER_URL || '/api/livekit-token'
    const body = {
      room: roomName || seatRequest.stream_id || `stream-${seatRequest.stream_id}`,
      identity: identity || (`seat-${seatRequest.id}`),
      type: 'seat',
      seat_id: seatRequest.id,
      stream_id: seatRequest.stream_id,
    }

    try {
      abortRef.current = new AbortController()
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Token endpoint error: ${res.status} ${text}`)
      }

      const data = await res.json().catch(() => null)
      const token = data?.token || data?.accessToken || data?.jwt || null

      // Wait 2s to represent spinner duration while token is processed
      await new Promise((r) => setTimeout(r, 2000))

      if (!token) {
        throw new Error('No token received')
      }

      tokenRef.current = token
      setState('connected')
      setIsConnected(true)
      onToken?.(token)
      return token
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Cancelled')
      } else {
        console.warn('[useSeatLiveKit] token request failed', err)
        setError(String(err?.message || err || 'Token request failed'))
      }
      setState('failed')
      setIsConnected(false)
      onToken?.(null)
      return null
    }
  }

  const disconnect = async () => {
    try {
      if (abortRef.current) abortRef.current.abort()
    } catch {}
    tokenRef.current = null
    setIsConnected(false)
    setHasPublishedTracks(false)
    setState('cleanup')
  }

  return {
    status: { state, isConnected, hasPublishedTracks, error, token: tokenRef.current },
    connectForSeat,
    disconnect,
  }
}
