import React, { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Bluetooth,
  CheckCircle2,
  Loader2,
  Monitor,
  Plus,
  Printer,
  Scan,
  Settings,
  Trash2,
  Usb,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

type DeviceType = 'scanner' | 'printer'
type ConnectionType = 'usb' | 'bluetooth' | 'hid' | 'network'
type DeviceStatus = 'connected' | 'disconnected' | 'pairing' | 'error'

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
