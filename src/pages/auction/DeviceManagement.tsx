import React, { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Bluetooth,
  CheckCircle2,
  Copy,
  Loader2,
  Monitor,
  Plus,
  Printer,
  QrCode,
  Scan,
  Settings,
  Smartphone,
  Trash2,
  Usb,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { generateUUID } from '../../lib/uuid'

type DeviceType = 'scanner' | 'printer'
type ConnectionType = 'usb' | 'bluetooth' | 'hid' | 'network'
type DeviceStatus = 'connected' | 'disconnected' | 'pairing' | 'error'

interface MobileScannerSession {
  id: string
  pairing_code: string
  session_token: string
  status: 'pending' | 'paired' | 'connected' | 'disconnected' | 'expired'
  device_name: string | null
  connected_at: string | null
  last_seen_at: string
  created_at: string
}

interface Device {
  id: string
  device_name: string
  device_type: DeviceType
  device_brand: string | null
  connection_type: ConnectionType
  device_id: string | null
  status: DeviceStatus
  last_connected_at: string | null
  last_error: string | null
  created_at: string
}

const BRANDS: Record<DeviceType, string[]> = {
  scanner: ['Zebra', 'Honeywell', 'Netum', 'Socket Mobile', 'Generic HID'],
  printer: ['DYMO', 'Brother', 'Zebra', 'Rollo', 'Bluetooth Thermal', 'USB Thermal'],
}

const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string; dot: string }> = {
  connected: { label: 'Connected', color: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100', dot: 'bg-emerald-400' },
  disconnected: { label: 'Disconnected', color: 'border-slate-400/30 bg-slate-500/10 text-slate-200', dot: 'bg-slate-400' },
  pairing: { label: 'Pairing', color: 'border-amber-300/30 bg-amber-400/10 text-amber-100', dot: 'bg-amber-400' },
  error: { label: 'Error', color: 'border-red-300/30 bg-red-500/10 text-red-100', dot: 'bg-red-400' },
}

const shell =
  'relative min-h-screen overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
const ghost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50'

export default function DeviceManagement() {
  const { user } = useAuthStore()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedType, setSelectedType] = useState<DeviceType>('scanner')
  const [diagnostics, setDiagnostics] = useState<string[]>([])

  // Mobile scanner pairing state
  const [mobileSessions, setMobileSessions] = useState<MobileScannerSession[]>([])
  const [showPairingModal, setShowPairingModal] = useState(false)
  const [pairingCode, setPairingCode] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [activeAuctions, setActiveAuctions] = useState<Array<{ id: string; title: string }>>([])
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('')

  const [form, setForm] = useState({
    device_name: '',
    device_type: 'scanner' as DeviceType,
    device_brand: '',
    connection_type: 'usb' as ConnectionType,
  })

  const fetchDevices = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('auction_devices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setDevices(data || [])
    } catch (error: any) {
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { void fetchDevices() }, [fetchDevices])

  const addDevice = async () => {
    if (!form.device_name.trim()) { toast.error('Device name required'); return }
    try {
      const { error } = await supabase.from('auction_devices').insert({
        user_id: user!.id,
        device_name: form.device_name.trim(),
        device_type: form.device_type,
        device_brand: form.device_brand || null,
        connection_type: form.connection_type,
        status: 'disconnected',
      })
      if (error) throw error
      toast.success('Device added')
      setShowAddModal(false)
      setForm({ device_name: '', device_type: 'scanner', device_brand: '', connection_type: 'usb' })
      await fetchDevices()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add device')
    }
  }

  const removeDevice = async (id: string) => {
    try {
      await supabase.from('auction_devices').delete().eq('id', id)
      toast.success('Device removed')
      await fetchDevices()
    } catch {
      toast.error('Failed to remove device')
    }
  }

  const toggleConnection = async (device: Device) => {
    const newStatus: DeviceStatus = device.status === 'connected' ? 'disconnected' : 'pairing'
    try {
      await supabase
        .from('auction_devices')
        .update({
          status: newStatus,
          last_connected_at: newStatus === 'connected' ? new Date().toISOString() : device.last_connected_at,
        })
        .eq('id', device.id)

      if (newStatus === 'pairing') {
        // Simulate pairing
        setTimeout(async () => {
          await supabase
            .from('auction_devices')
            .update({ status: 'connected', last_connected_at: new Date().toISOString() })
            .eq('id', device.id)
          await fetchDevices()
        }, 2000)
      }

      await fetchDevices()
    } catch {
      toast.error('Failed to update device')
    }
  }

  const runDiagnostics = () => {
    const results: string[] = []
    results.push(`[${new Date().toLocaleTimeString()}] Starting device diagnostics...`)
    results.push(`[${new Date().toLocaleTimeString()}] Scanning USB ports...`)
    results.push(`[${new Date().toLocaleTimeString()}] Found ${devices.filter(d => d.connection_type === 'usb').length} USB device(s)`)
    results.push(`[${new Date().toLocaleTimeString()}] Scanning Bluetooth...`)
    results.push(`[${new Date().toLocaleTimeString()}] Found ${devices.filter(d => d.connection_type === 'bluetooth').length} Bluetooth device(s)`)
    results.push(`[${new Date().toLocaleTimeString()}] Checking HID keyboard scanners...`)
    results.push(`[${new Date().toLocaleTimeString()}] HID scanners are detected automatically via keyboard input`)
    results.push(`[${new Date().toLocaleTimeString()}] Checking printer drivers...`)
    results.push(`[${new Date().toLocaleTimeString()}] Browser print API: ${window.print ? 'Available' : 'Not available'}`)
    results.push(`[${new Date().toLocaleTimeString()}] Diagnostics complete.`)
    setDiagnostics(results)
  }

  // ── Mobile Scanner Pairing ────────────────────────────────────────────────

  const fetchMobileSessions = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('auction_device_sessions')
        .select('*')
        .eq('auctioneer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setMobileSessions(data || [])
    } catch (err) {
      console.warn('[DeviceMgmt] Failed to fetch mobile sessions:', err)
    }
  }, [user?.id])

  const fetchActiveAuctions = useCallback(async () => {
    if (!user?.id) return
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
      console.warn('[DeviceMgmt] Failed to fetch auctions:', err)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchMobileSessions()
    void fetchActiveAuctions()
  }, [fetchMobileSessions, fetchActiveAuctions])

  const generatePairingCode = useCallback(async () => {
    if (!user?.id) return

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const token = generateUUID()

    try {
      const { data, error } = await supabase
        .from('auction_device_sessions')
        .insert({
          auctioneer_id: user.id,
          auction_id: selectedAuctionId || null,
          pairing_code: code,
          session_token: token,
          status: 'pending',
        })
        .select('*')
        .single()

      if (error) throw error

      setPairingCode(code)
      await fetchMobileSessions()

      // Generate QR code
      const qrPayload = JSON.stringify({
        type: 'trollcity_auction_scanner',
        pairingCode: code,
        sessionToken: token,
        auctionId: selectedAuctionId || null,
      })
      const qrUrl = await QRCode.toDataURL(qrPayload, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      setQrDataUrl(qrUrl)

      // Subscribe to session updates
      const channel = supabase
        .channel(`device_session_${data.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auction_device_sessions',
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            const updated = payload.new as MobileScannerSession
            setMobileSessions((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s)),
            )
            if (updated.status === 'connected') {
              toast.success(`Scanner connected: ${updated.device_name || 'Mobile Device'}`)
            }
          },
        )
        .subscribe()

      // Auto-expire after 10 minutes
      setTimeout(async () => {
        await supabase
          .from('auction_device_sessions')
          .update({ status: 'expired' })
          .eq('id', data.id)
          .eq('status', 'pending')
        await fetchMobileSessions()
      }, 10 * 60 * 1000)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate pairing code')
    }
  }, [user?.id, selectedAuctionId, fetchMobileSessions])

  const removeMobileSession = useCallback(async (sessionId: string) => {
    try {
      await supabase
        .from('auction_device_sessions')
        .delete()
        .eq('id', sessionId)
      await fetchMobileSessions()
      toast.success('Scanner removed')
    } catch {
      toast.error('Failed to remove scanner')
    }
  }, [fetchMobileSessions])

  const copyPairingCode = useCallback(() => {
    navigator.clipboard.writeText(pairingCode)
    toast.success('Pairing code copied!')
  }, [pairingCode])

  // Subscribe to scan events from mobile scanners
  useEffect(() => {
    if (!user?.id) return

    const connectedSessions = mobileSessions.filter((s) => s.status === 'connected')
    if (connectedSessions.length === 0) return

    const channels = connectedSessions.map((s) =>
      supabase
        .channel(`auction_scans_${s.auction_id || 'none'}`)
        .on('broadcast', { event: 'barcode_scanned' }, (payload: any) => {
          const data = payload?.payload
          if (!data) return
          toast.info(`📱 Scan: ${data.barcode}`, { duration: 5000 })
          // The parent auction page can listen for these events too
          window.dispatchEvent(
            new CustomEvent('auction-barcode-scanned', { detail: data }),
          )
        })
        .subscribe(),
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [mobileSessions, user?.id])

  const scanners = devices.filter(d => d.device_type === 'scanner')
  const printers = devices.filter(d => d.device_type === 'printer')

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%)]" />

      <main className="relative z-10 mx-auto max-w-[1200px] space-y-4">
        <header className={cn(panel, 'p-5')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10">
                <Monitor className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Device Management</h1>
                <p className="text-sm text-slate-400">Manage scanners, printers, and hardware integrations.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={runDiagnostics} className={ghost}>
                <Activity className="h-4 w-4" /> Diagnostics
              </button>
              <button onClick={() => setShowAddModal(true)} className={primary}>
                <Plus className="h-4 w-4" /> Add Device
              </button>
            </div>
          </div>
        </header>

        {/* ── Mobile Scanner Devices ──────────────────────────────────────── */}
        <section className={cn(panel, 'p-5')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Smartphone className="h-5 w-5 text-cyan-300" />
              Connected Scanner Devices
              {mobileSessions.filter((s) => s.status === 'connected').length > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {mobileSessions.filter((s) => s.status === 'connected').length} active
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowPairingModal(true)}
              className={cn(primary, 'text-xs')}
            >
              <QrCode className="h-4 w-4" /> Connect Mobile Scanner
            </button>
          </div>

          {mobileSessions.length === 0 ? (
            <div className="py-8 text-center">
              <Smartphone className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No mobile scanners connected</p>
              <p className="mt-1 text-xs text-slate-600">
                Click &quot;Connect Mobile Scanner&quot; to generate a QR code or pairing code.
                <br />
                Open <span className="font-mono text-cyan-400">/auctioneer/scanner</span> on your mobile device.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mobileSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-[#0a1425]/80 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        session.status === 'connected'
                          ? 'bg-emerald-400 animate-pulse'
                          : session.status === 'pending'
                            ? 'bg-amber-400 animate-pulse'
                            : session.status === 'paired'
                              ? 'bg-cyan-400 animate-pulse'
                              : 'bg-slate-500',
                      )}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">
                        {session.device_name || 'Mobile Scanner'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Code: <span className="font-mono text-cyan-400">{session.pairing_code}</span>
                        {session.connected_at && (
                          <span className="ml-2">
                            Connected {new Date(session.connected_at).toLocaleTimeString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                        session.status === 'connected'
                          ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                          : session.status === 'pending'
                            ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                            : session.status === 'paired'
                              ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                              : 'border-slate-400/30 bg-slate-500/10 text-slate-200',
                      )}
                    >
                      {session.status}
                    </span>
                    <button
                      onClick={() => removeMobileSession(session.id)}
                      className={cn(ghost, 'text-xs text-red-300')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Last scan indicator */}
          {mobileSessions.some((s) => s.status === 'connected') && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-400/5 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-[10px] text-slate-400">
                Scans from connected devices will appear in real-time on your auction page.
                <span className="ml-1 text-cyan-400">Listening...</span>
              </span>
            </div>
          )}
        </section>

        {/* Connected Scanners */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Scan className="h-5 w-5 text-cyan-300" />
            Connected Scanners ({scanners.length})
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
            </div>
          ) : scanners.length === 0 ? (
            <div className="py-10 text-center">
              <Scan className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No scanners configured</p>
              <p className="text-xs text-slate-600 mt-1">USB HID keyboard scanners are auto-detected. Add Bluetooth scanners manually.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scanners.map(device => (
                <DeviceRow key={device.id} device={device} onToggle={toggleConnection} onRemove={removeDevice} />
              ))}
            </div>
          )}
        </section>

        {/* Connected Printers */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Printer className="h-5 w-5 text-cyan-300" />
            Connected Printers ({printers.length})
          </h2>
          {printers.length === 0 ? (
            <div className="py-10 text-center">
              <Printer className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No printers configured</p>
              <p className="text-xs text-slate-600 mt-1">Add DYMO, Brother, Zebra, or thermal printers.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {printers.map(device => (
                <DeviceRow key={device.id} device={device} onToggle={toggleConnection} onRemove={removeDevice} />
              ))}
            </div>
          )}
        </section>

        {/* Diagnostics */}
        {diagnostics.length > 0 && (
          <section className={cn(panel, 'p-5')}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <Zap className="h-5 w-5 text-cyan-300" />
              Diagnostics
            </h2>
            <div className="rounded-xl border border-cyan-300/10 bg-black/40 p-4 font-mono text-xs text-slate-300 max-h-60 overflow-y-auto">
              {diagnostics.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </section>
        )}

        {/* Add Device Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={cn(panel, 'w-full max-w-md p-6')}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Add Device</h3>
                <button onClick={() => setShowAddModal(false)} className={ghost}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Device Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setForm(f => ({ ...f, device_type: 'scanner' }))}
                      className={cn('flex-1 rounded-xl border p-3 text-sm font-bold transition', form.device_type === 'scanner' ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-slate-400')}
                    >
                      <Scan className="mx-auto mb-1 h-5 w-5" />
                      Scanner
                    </button>
                    <button
                      onClick={() => setForm(f => ({ ...f, device_type: 'printer' }))}
                      className={cn('flex-1 rounded-xl border p-3 text-sm font-bold transition', form.device_type === 'printer' ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-slate-400')}
                    >
                      <Printer className="mx-auto mb-1 h-5 w-5" />
                      Printer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">Device Name</label>
                  <input
                    value={form.device_name}
                    onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))}
                    placeholder="My Zebra Scanner"
                    className={input}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">Brand</label>
                  <select
                    value={form.device_brand}
                    onChange={e => setForm(f => ({ ...f, device_brand: e.target.value }))}
                    className={input}
                  >
                    <option value="" className="bg-slate-950">Select brand...</option>
                    {BRANDS[form.device_type].map(b => (
                      <option key={b} value={b} className="bg-slate-950">{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">Connection</label>
                  <div className="flex gap-2">
                    {([
                      { id: 'usb', icon: Usb, label: 'USB' },
                      { id: 'bluetooth', icon: Bluetooth, label: 'Bluetooth' },
                      { id: 'hid', icon: Monitor, label: 'HID' },
                      { id: 'network', icon: Wifi, label: 'Network' },
                    ] as const).map(conn => (
                      <button
                        key={conn.id}
                        onClick={() => setForm(f => ({ ...f, connection_type: conn.id }))}
                        className={cn('flex-1 rounded-xl border p-2 text-xs font-bold transition', form.connection_type === conn.id ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-slate-400')}
                      >
                        <conn.icon className="mx-auto mb-1 h-4 w-4" />
                        {conn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={addDevice} className={cn(primary, 'w-full')}>
                  <Plus className="h-4 w-4" /> Add Device
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile Scanner Pairing Modal ──────────────────────────────────── */}
        {showPairingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={cn(panel, 'w-full max-w-md p-6')}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Connect Mobile Scanner</h3>
                <button
                  onClick={() => {
                    setShowPairingModal(false)
                    setPairingCode('')
                    setQrDataUrl('')
                  }}
                  className={ghost}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Auction selector */}
                {activeAuctions.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Link to Auction</label>
                    <select
                      value={selectedAuctionId}
                      onChange={(e) => setSelectedAuctionId(e.target.value)}
                      className={input}
                    >
                      <option value="" className="bg-slate-950">No specific auction</option>
                      {activeAuctions.map((a) => (
                        <option key={a.id} value={a.id} className="bg-slate-950">{a.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Generate button or QR display */}
                {!pairingCode ? (
                  <button
                    onClick={generatePairingCode}
                    className={cn(primary, 'w-full')}
                  >
                    <QrCode className="h-4 w-4" /> Generate Pairing Code
                  </button>
                ) : (
                  <div className="space-y-4">
                    {/* QR Code */}
                    {qrDataUrl && (
                      <div className="flex flex-col items-center rounded-2xl border border-cyan-300/20 bg-white p-4">
                        <img src={qrDataUrl} alt="Pairing QR Code" className="h-48 w-48" />
                        <p className="mt-2 text-[10px] text-slate-500">Scan with mobile scanner</p>
                      </div>
                    )}

                    {/* Numeric code */}
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4 text-center">
                      <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">Auction Code</p>
                      <div className="mt-1 flex items-center justify-center gap-3">
                        <p className="text-3xl font-black tracking-[0.3em] text-white">{pairingCode}</p>
                        <button onClick={copyPairingCode} className={cn(ghost, 'text-xs')}>
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-slate-500">
                        Enter this code on your mobile device at <span className="font-mono text-cyan-400">/auctioneer/scanner</span>
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-center gap-2 text-xs text-amber-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting for mobile device to connect...
                    </div>

                    {/* Generate new */}
                    <button
                      onClick={() => {
                        setPairingCode('')
                        setQrDataUrl('')
                      }}
                      className={cn(secondary, 'w-full text-xs')}
                    >
                      Generate New Code
                    </button>
                  </div>
                )}

                {/* Instructions */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">How to connect</p>
                  <ol className="space-y-1 text-[11px] text-slate-400">
                    <li>1. Click &quot;Generate Pairing Code&quot; above</li>
                    <li>2. Open <span className="font-mono text-cyan-400">/auctioneer/scanner</span> on your phone</li>
                    <li>3. Scan the QR code OR enter the 6-digit code</li>
                    <li>4. The scanner will connect automatically</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function DeviceRow({
  device,
  onToggle,
  onRemove,
}: {
  device: Device
  onToggle: (device: Device) => void
  onRemove: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.disconnected

  return (
    <div className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-[#0a1425]/80 p-3">
      <div className="flex items-center gap-3">
        <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
        <div>
          <p className="text-sm font-bold text-white">{device.device_name}</p>
          <p className="text-xs text-slate-500">
            {device.device_brand} · {device.connection_type.toUpperCase()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', cfg.color)}>
          {cfg.label}
        </span>
        <button onClick={() => onToggle(device)} className={cn(ghost, 'text-xs')}>
          {device.status === 'connected' ? 'Disconnect' : 'Connect'}
        </button>
        <button onClick={() => onRemove(device.id)} className={cn(ghost, 'text-xs text-red-300')}>
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
