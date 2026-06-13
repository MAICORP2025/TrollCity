import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Flashlight,
  FlashlightOff,
  Loader2,
  QrCode,
  RefreshCw,
  Scan,
  Send,
  Settings,
  Smartphone,
  Unlink,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { generateUUID } from '@/lib/uuid'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionState = 'disconnected' | 'pairing' | 'connecting' | 'connected' | 'error'

interface DeviceSession {
  id: string
  auction_id: string | null
  pairing_code: string
  session_token: string
  status: 'pending' | 'paired' | 'connected' | 'disconnected' | 'expired'
  connected_at: string | null
  last_seen_at: string
}

interface ScanResult {
  id: string
  barcode: string
  barcodeType: string
  timestamp: number
  synced: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generatePairingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function generateSessionToken(): string {
  return generateUUID()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuctioneerScanner() {
  const { user, profile } = useAuthStore()

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [session, setSession] = useState<DeviceSession | null>(null)
  const [pairingCode, setPairingCode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [activeAuctions, setActiveAuctions] = useState<Array<{ id: string; title: string }>>([])

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [scanCount, setScanCount] = useState(0)

  // UI state
  const [showPairingModal, setShowPairingModal] = useState(true)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const barcodeDetectorRef = useRef<any>(null)
  const scanChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastScanTimeRef = useRef(0)

  // ── Fetch active auctions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    const fetchAuctions = async () => {
      try {
        const { data } = await supabase
          .from('auction_shows')
          .select('id, title')
          .eq('auctioneer_id', user.id)
          .in('status', ['scheduled', 'live'])
          .order('created_at', { ascending: false })
          .limit(10)
        setActiveAuctions(data || [])
      } catch (err) {
        console.warn('[Scanner] Failed to fetch auctions:', err)
      }
    }
    void fetchAuctions()
  }, [user?.id])

  // ── Barcode Detection API support check ───────────────────────────────────

  useEffect(() => {
    // Check if BarcodeDetector is available (Chrome on Android, Edge)
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
      } catch (err) {
        console.warn('[Scanner] BarcodeDetector init failed:', err)
      }
    }
  }, [])

  // ── Camera management ─────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err: any) {
      console.error('[Scanner] Camera error:', err)
      setError(err?.message || 'Camera access denied. Please allow camera permissions.')
      setCameraActive(false)
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const toggleCamera = useCallback(() => {
    stopCamera()
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }, [stopCamera])

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraActive) {
      stopCamera()
      setTimeout(() => startCamera(), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (scanChannelRef.current) supabase.removeChannel(scanChannelRef.current)
    }
  }, [stopCamera])

  // ── Barcode scanning loop ─────────────────────────────────────────────────

  useEffect(() => {
    if (!cameraActive || !barcodeDetectorRef.current) return

    let animFrame: number
    const detectFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrame = requestAnimationFrame(detectFrame)
        return
      }

      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current)
        if (barcodes && barcodes.length > 0) {
          const now = Date.now()
          // Debounce: ignore scans within 2 seconds of last scan
          if (now - lastScanTimeRef.current < 2000) {
            animFrame = requestAnimationFrame(detectFrame)
            return
          }
          lastScanTimeRef.current = now

          const barcode = barcodes[0]
          const result: ScanResult = {
            id: generateUUID(),
            barcode: barcode.rawValue || '',
            barcodeType: barcode.format || 'unknown',
            timestamp: now,
            synced: false,
          }

          setLastScan(result)
          setScanHistory((prev) => [result, ...prev].slice(0, 50))
          setScanCount((c) => c + 1)

          // Send to desktop if connected
          if (connectionState === 'connected' && session) {
            await sendScanToDesktop(result)
          }

          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(100)
        }
      } catch {
        // Detection failed silently
      }

      animFrame = requestAnimationFrame(detectFrame)
    }

    animFrame = requestAnimationFrame(detectFrame)
    return () => cancelAnimationFrame(animFrame)
  }, [cameraActive, connectionState, session])

  // ── Send scan to desktop via Supabase realtime ────────────────────────────

  const sendScanToDesktop = useCallback(
    async (scan: ScanResult) => {
      if (!session) return

      try {
        // Send via realtime broadcast
        const channel = supabase.channel(`auction_scans:${session.auction_id || 'none'}`)
        await channel.send({
          type: 'broadcast',
          event: 'barcode_scanned',
          payload: {
            auctionId: session.auction_id,
            deviceId: session.id,
            barcode: scan.barcode,
            barcodeType: scan.barcodeType,
            timestamp: new Date(scan.timestamp).toISOString(),
          },
        })

        // Also persist to DB
        await supabase.from('auction_scan_events').insert({
          auction_id: session.auction_id,
          device_session_id: session.id,
          barcode: scan.barcode,
          barcode_type: scan.barcodeType,
          payload: { source: 'mobile_scanner' },
        })

        // Mark as synced
        setLastScan((prev) => (prev?.id === scan.id ? { ...prev, synced: true } : prev))
        setScanHistory((prev) =>
          prev.map((s) => (s.id === scan.id ? { ...s, synced: true } : s)),
        )
      } catch (err) {
        console.warn('[Scanner] Failed to send scan:', err)
      }
    },
    [session],
  )

  // ── Manual barcode entry ──────────────────────────────────────────────────

  const handleManualEntry = useCallback(async () => {
    const code = manualCode.trim()
    if (!code) return

    const result: ScanResult = {
      id: generateUUID(),
      barcode: code,
      barcodeType: 'manual',
      timestamp: Date.now(),
      synced: false,
    }

    setLastScan(result)
    setScanHistory((prev) => [result, ...prev].slice(0, 50))
    setScanCount((c) => c + 1)
    setManualCode('')
    setShowManualEntry(false)

    if (connectionState === 'connected' && session) {
      await sendScanToDesktop(result)
    }

    if (navigator.vibrate) navigator.vibrate(50)
  }, [manualCode, connectionState, session, sendScanToDesktop])

  // ── Pairing: create a new device session ──────────────────────────────────

  const createPairingSession = useCallback(async () => {
    if (!user?.id) return

    setConnectionState('pairing')
    setError(null)

    const code = generatePairingCode()
    const token = generateSessionToken()

    try {
      const { data, error: dbError } = await supabase
        .from('auction_device_sessions')
        .insert({
          auctioneer_id: user.id,
          auction_id: auctionId,
          pairing_code: code,
          session_token: token,
          device_id: `mobile-${generateUUID().slice(0, 8)}`,
          device_name: navigator.userAgent?.match(/Android|iPhone|iPad/i)?.[0] || 'Mobile Device',
          device_info: {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            screen: `${screen.width}x${screen.height}`,
          },
          status: 'pending',
        })
        .select('*')
        .single()

      if (dbError) throw dbError

      setPairingCode(code)
      setSession(data as DeviceSession)

      // Subscribe to session updates (desktop may update status)
      const channel = supabase
        .channel(`scanner_session_${data.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'auction_device_sessions',
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            const updated = payload.new as DeviceSession
            setSession(updated)
            if (updated.status === 'expired') {
              setConnectionState('error')
              setError('Pairing code expired. Please generate a new one.')
            }
          },
        )
        .subscribe()

      scanChannelRef.current = channel

      // Mark the session as connected immediately since the scanner is active
      // This ensures the desktop side sees the scanner as connected right away
      // and we don't show the "waiting for desktop" modal
      void (async () => {
        try {
          const { data: updatedSession } = await supabase
            .from('auction_device_sessions')
            .update({ status: 'connected', connected_at: new Date().toISOString() })
            .eq('id', data.id)
            .select('*')
            .single()
          if (updatedSession) {
            setSession(updatedSession as DeviceSession)
            setConnectionState('connected')
            toast.success('Scanner connected!')
            startHeartbeat()
          }
        } catch (err) {
          console.warn('[Scanner] Failed to mark as connected:', err)
        }
      })()
    } catch (err: any) {
      console.error('[Scanner] Pairing failed:', err)
      setError(err?.message || 'Failed to create pairing session')
      setConnectionState('error')
    }
  }, [user?.id, auctionId, session?.status])

  // ── Pairing: connect with manual code ─────────────────────────────────────

  const connectWithCode = useCallback(async () => {
    const code = manualCode.trim()
    if (!code || code.length !== 6) {
      toast.error('Enter a valid 6-digit pairing code')
      return
    }

    setConnectionState('connecting')
    setError(null)

    try {
      // Find the device session by pairing code
      const { data: existingSession, error: findError } = await supabase
        .from('auction_device_sessions')
        .select('*')
        .eq('pairing_code', code)
        .eq('status', 'pending')
        .maybeSingle()

      if (findError) throw findError

      if (!existingSession) {
        // No pending session found — create a new one with this code
        // This handles the case where the mobile device initiates
        const token = generateSessionToken()
        const { data, error: createError } = await supabase
          .from('auction_device_sessions')
          .insert({
            auctioneer_id: user!.id,
            auction_id: auctionId,
            pairing_code: code,
            session_token: token,
            device_id: `mobile-${generateUUID().slice(0, 8)}`,
            device_name: 'Mobile Scanner',
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .select('*')
          .single()

        if (createError) throw createError

        setSession(data as DeviceSession)
        setConnectionState('connected')
        setShowPairingModal(false)
        toast.success('Connected to auction!')
        startHeartbeat()
      } else {
        // Found a pending session — mark as connected
        const { data, error: updateError } = await supabase
          .from('auction_device_sessions')
          .update({
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .eq('id', existingSession.id)
          .select('*')
          .single()

        if (updateError) throw updateError

        setSession(data as DeviceSession)
        setConnectionState('connected')
        setShowPairingModal(false)
        toast.success('Connected to auction!')
        startHeartbeat()
      }
    } catch (err: any) {
      console.error('[Scanner] Connect failed:', err)
      setError(err?.message || 'Failed to connect')
      setConnectionState('error')
    }

    setManualCode('')
  }, [manualCode, user, auctionId])

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(async () => {
      if (session?.id) {
        await supabase
          .from('auction_device_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', session.id)
      }
    }, 15000)
  }, [session?.id])

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (session?.id) {
      // Delete the session from DB so desktop device list removes this scanner
      await supabase
        .from('auction_device_sessions')
        .delete()
        .eq('id', session.id)
    }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (scanChannelRef.current) supabase.removeChannel(scanChannelRef.current)
    setSession(null)
    setConnectionState('disconnected')
    setPairingCode('')
    stopCamera()
  }, [session?.id, stopCamera])

  // ── Render ─────────────────────────────────────────────────────────────────

  const isAuctioneer = profile?.is_auctioneer === true ||
    (profile?.role as string) === 'auctioneer' ||
    profile?.role === 'admin'

  if (!isAuctioneer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101f] p-6 text-white">
        <div className="text-center">
          <Smartphone className="mx-auto h-16 w-16 text-slate-600" />
          <h1 className="mt-4 text-xl font-black">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-400">Only authorized auctioneers can use the mobile scanner.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#07101f] text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-cyan-300/10 bg-[#0b1628]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10">
            <Scan className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-sm font-black">Auction Scanner</h1>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  connectionState === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionState === 'connecting' || connectionState === 'pairing'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500',
                )}
              />
              <span className="text-[10px] font-bold text-slate-400">
                {connectionState === 'connected'
                  ? 'Connected'
                  : connectionState === 'connecting'
                    ? 'Connecting...'
                    : connectionState === 'pairing'
                      ? 'Pairing...'
                      : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connectionState === 'connected' && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              <Wifi className="h-3 w-3" /> Live
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <Clipboard className="h-4 w-4" />
            {scanCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-cyan-500 text-[8px] font-black text-white">
                {scanCount > 99 ? '99+' : scanCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Camera Preview ────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        {cameraActive ? (
          <div className="relative h-full w-full bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scan overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-56 w-56">
                {/* Corner brackets */}
                <div className="absolute -left-1 -top-1 h-8 w-8 border-l-2 border-t-2 border-cyan-400" />
                <div className="absolute -right-1 -top-1 h-8 w-8 border-r-2 border-t-2 border-cyan-400" />
                <div className="absolute -bottom-1 -left-1 h-8 w-8 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute -bottom-1 -right-1 h-8 w-8 border-b-2 border-r-2 border-cyan-400" />
                {/* Scanning line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
              </div>
            </div>

            {/* Camera controls overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
              <button
                onClick={() => setFlashOn(!flashOn)}
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-full border backdrop-blur-sm transition',
                  flashOn
                    ? 'border-amber-400/40 bg-amber-400/20 text-amber-200'
                    : 'border-white/20 bg-black/40 text-white/70',
                )}
              >
                {flashOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
              </button>
              <button
                onClick={stopCamera}
                className="grid h-14 w-14 place-items-center rounded-full border-2 border-red-400/60 bg-red-500/20 text-red-200 backdrop-blur-sm"
              >
                <CameraOff className="h-6 w-6" />
              </button>
              <button
                onClick={toggleCamera}
                className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white/70 backdrop-blur-sm"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          /* Camera off state */
          <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
            <div className="grid h-24 w-24 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10">
              <Camera className="h-12 w-12 text-cyan-300/60" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-black">Camera Scanner</h2>
              <p className="mt-1 text-sm text-slate-400">
                {barcodeDetectorRef.current
                  ? 'Point your camera at a barcode or QR code'
                  : 'Camera scanner — connect to auction first'}
              </p>
            </div>
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200"
            >
              <Camera className="h-5 w-5" />
              Start Camera
            </button>
            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Last scan toast */}
        {lastScan && (
          <div
            className={cn(
              'absolute left-4 right-4 top-4 z-20 rounded-2xl border px-4 py-3 backdrop-blur-xl transition-all',
              lastScan.synced
                ? 'border-emerald-400/30 bg-emerald-950/90'
                : 'border-amber-400/30 bg-amber-950/90',
            )}
          >
            <div className="flex items-center gap-3">
              {lastScan.synced ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white">
                  {lastScan.barcodeType === 'qr_code' ? 'QR Code' : lastScan.barcodeType.toUpperCase()}
                </p>
                <p className="truncate text-[11px] font-mono text-slate-300">{lastScan.barcode}</p>
              </div>
              <span className="text-[9px] font-bold text-slate-500">
                {lastScan.synced ? 'Synced' : 'Pending'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Controls ───────────────────────────────────────────────── */}
      <div className="border-t border-cyan-300/10 bg-[#0b1628]/90 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Connection button */}
          {connectionState === 'connected' ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-200"
            >
              <Unlink className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowPairingModal(true)}
              disabled={connectionState === 'pairing' || connectionState === 'connecting'}
              className="flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
            >
              {connectionState === 'pairing' || connectionState === 'connecting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {connectionState === 'pairing' ? 'Pairing...' : connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          )}

          {/* Manual entry */}
          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-200"
          >
            <Settings className="h-4 w-4" />
            Manual
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Scan count */}
          <span className="text-[10px] font-bold text-slate-500">
            {scanCount} scan{scanCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Pairing Modal ─────────────────────────────────────────────────── */}
      {showPairingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Connect Scanner</h2>
              <button
                onClick={async () => {
                  setShowPairingModal(false)
                  // Delete the session from DB so desktop device list removes this scanner
                  if (session?.id) {
                    try {
                      await supabase
                        .from('auction_device_sessions')
                        .delete()
                        .eq('id', session.id)
                    } catch (err) {
                      console.warn('[Scanner] Failed to delete session:', err)
                    }
                  }
                  setConnectionState('disconnected')
                  setSession(null)
                  setPairingCode('')
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!session || connectionState !== 'connected' ? (
              <div className="mt-4 space-y-4">
                {/* Method 1: Generate QR / Pairing Code */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Method 1: Pairing Code</p>
                  {pairingCode ? (
                    <div className="mt-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4 text-center">
                      <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">Auction Code</p>
                      <p className="mt-1 text-3xl font-black tracking-[0.3em] text-white">{pairingCode}</p>
                      <p className="mt-2 text-[10px] text-slate-500">Enter this code on your desktop auction device</p>
                      <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Waiting for desktop to connect...
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={createPairingSession}
                      className="mt-2 w-full rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950"
                    >
                      Generate Pairing Code
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-bold text-slate-500">OR</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* Method 2: Enter code from desktop */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Method 2: Enter Desktop Code</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      className="flex-1 rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-3 text-center text-lg font-black tracking-[0.2em] text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50"
                      maxLength={6}
                    />
                    <button
                      onClick={connectWithCode}
                      disabled={manualCode.length !== 6}
                      className="rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Active auction selector */}
                {activeAuctions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Auction</p>
                    <select
                      value={auctionId || ''}
                      onChange={(e) => setAuctionId(e.target.value || null)}
                      className="mt-2 w-full rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50"
                    >
                      <option value="">Select auction...</option>
                      {activeAuctions.map((a) => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="mt-2 text-sm font-black text-emerald-200">Connected!</p>
                <p className="mt-1 text-xs text-slate-400">Scanner is synced with your auction.</p>
                <button
                  onClick={() => setShowPairingModal(false)}
                  className="mt-4 w-full rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
                >
                  Start Scanning
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Entry Modal ────────────────────────────────────────────── */}
      {showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Manual Entry</h2>
              <button
                onClick={() => setShowManualEntry(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Enter barcode or lot number manually</p>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode or lot number..."
              className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
            />
            <button
              onClick={handleManualEntry}
              disabled={!manualCode.trim()}
              className="mt-3 w-full rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {/* ── Scan History Sheet ────────────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowHistory(false)}>
          <div
            className="max-h-[70vh] rounded-t-3xl border-t border-cyan-300/10 bg-[#0b1628] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Scan History ({scanHistory.length})</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
              {scanHistory.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">No scans yet</p>
              ) : (
                scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    {scan.synced ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-mono text-white">{scan.barcode}</p>
                      <p className="text-[9px] text-slate-500">
                        {scan.barcodeType} • {new Date(scan.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
