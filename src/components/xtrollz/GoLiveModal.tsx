import { X, Radio, Lock, Crown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { XTROLLZ_CATEGORIES } from '@/lib/xtrollz'

interface GoLiveModalProps {
  onClose: () => void
}

export default function GoLiveModal({ onClose }: GoLiveModalProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Chat')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [starting, setStarting] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [selectedMic, setSelectedMic] = useState('')
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [showDevices, setShowDevices] = useState(false)
  const [prices, setPrices] = useState({ subscription_price: 800, private_show_price: 500, tip_message_price: 50 })
  const [savingPrices, setSavingPrices] = useState(false)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const video = devs.filter((d) => d.kind === 'videoinput')
      const audio = devs.filter((d) => d.kind === 'audioinput')
      setDevices(devs)
      if (video.length) setSelectedCamera(video[0].deviceId)
      if (audio.length) setSelectedMic(audio[0].deviceId)
    })
  }, [])

  useEffect(() => {
    if (!showDevices || !selectedCamera) return
    let stream: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined },
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined },
      })
      .then((s) => {
        stream = s
        setPreviewStream(s)
      })
      .catch(() => {})
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      setPreviewStream(null)
    }
  }, [showDevices, selectedCamera, selectedMic])

  const handleStart = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title')
      return
    }
    if (!rulesAccepted) {
      toast.error('You must accept the room rules before broadcasting')
      return
    }
    if (isPrivate && !password.trim()) {
      toast.error('Please set a password for private streams')
      return
    }
    setStarting(true)
    try {
      const { data, error } = await supabase.rpc('xtrollz_start_broadcast', {
        p_user_id: user?.id,
        p_title: title,
        p_category: category,
        p_description: description || null,
        p_is_private: isPrivate,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.message || 'Failed to start broadcast')

      const streamId = data.stream_id
      if (isPrivate) {
        const { error: updateError } = await supabase
          .from('xtrollz_streams')
          .update({ password_hash: password, password_created_at: new Date().toISOString() })
          .eq('id', streamId)
        if (updateError) console.warn('Failed to set password:', updateError)
      }

      navigate(`/xtrollz/live/${streamId}`, { replace: true })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start broadcast')
    } finally {
      setStarting(false)
    }
  }

  const handleSavePrices = async () => {
    if (!user?.id) return
    setSavingPrices(true)
    try {
      const { error } = await supabase.rpc('xtrollz_set_streamer_prices', {
        p_user_id: user.id,
        p_subscription_price: prices.subscription_price,
        p_private_show_price: prices.private_show_price,
        p_tip_message_price: prices.tip_message_price,
        p_description: description,
      })
      if (error) throw error
      toast.success('Prices updated')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update prices')
    } finally {
      setSavingPrices(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10">
              <Radio size={18} className="text-purple-300" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Go Live</p>
              <p className="text-xs text-white/60">Set up your broadcast</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Stream Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="What's your stream about?"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
            >
              {XTROLLZ_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900">
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell viewers what your stream is about..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
            />
          </label>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-white/60" />
              <span className="text-xs font-bold text-white">Private Stream</span>
            </div>
            <button
              onClick={() => setIsPrivate((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? 'bg-purple-600' : 'bg-white/20'}`}
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {isPrivate && (
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Stream Password</span>
              <div className="flex gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
                <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDevices((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
            >
              <Radio size={14} />
              {showDevices ? 'Hide' : 'Show'} Preview
            </button>
          </div>

          {showDevices && devices.length > 0 && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Camera</span>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  >
                    {devices
                      .filter((d) => d.kind === 'videoinput')
                      .map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Microphone</span>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  >
                    {devices
                      .filter((d) => d.kind === 'audioinput')
                      .map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">
                          {d.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {previewStream && (
                <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
                  <video ref={(el) => { if (el) el.srcObject = previewStream }} autoPlay muted playsInline className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Price settings */}
          <div className="rounded-xl border border-purple-400/20 bg-purple-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-purple-300" />
              <span className="text-xs font-black text-white uppercase tracking-widest">Your Pricing</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Subscription (TC)</span>
                <input
                  type="number"
                  value={prices.subscription_price}
                  onChange={(e) => setPrices((p) => ({ ...p, subscription_price: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Private Show (TC)</span>
                <input
                  type="number"
                  value={prices.private_show_price}
                  onChange={(e) => setPrices((p) => ({ ...p, private_show_price: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">Tip Message (TC)</span>
                <input
                  type="number"
                  value={prices.tip_message_price}
                  onChange={(e) => setPrices((p) => ({ ...p, tip_message_price: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </label>
            </div>
            <button
              onClick={handleSavePrices}
              disabled={savingPrices}
              className="w-full rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {savingPrices ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <input
              type="checkbox"
              checked={rulesAccepted}
              onChange={(e) => setRulesAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-purple-600 focus:ring-purple-400/30"
            />
            <span className="text-xs text-white/70">
              I have read and agree to the{' '}
              <button onClick={() => navigate('/xtrollz/rules')} className="text-purple-300 underline hover:text-purple-200">
                XTrollz Room Rules & Guidelines
              </button>
              . I understand that private streams may be monitored.
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-black text-white hover:bg-white/10">
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-black text-white hover:bg-purple-500 disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            >
              <Radio size={16} />
              {starting ? 'Starting...' : 'Start Broadcast'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
