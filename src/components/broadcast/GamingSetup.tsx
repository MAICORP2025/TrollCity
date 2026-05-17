import React from 'react'
import {
  Radio,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  MonitorPlay,
} from 'lucide-react'
import { toast } from 'sonner'

interface GamingSetupProps {
  streamTitle?: string
  rtmpUrl?: string | null
  streamKey?: string | null
}

export function GamingSetup({
  streamTitle,
  rtmpUrl,
  streamKey,
}: GamingSetupProps) {
  const [copiedKey, setCopiedKey] = React.useState(false)
  const [copiedUrl, setCopiedUrl] = React.useState(false)

  const hasCredentials = !!(rtmpUrl && streamKey)
  const displayRtmpUrl = rtmpUrl || 'rtmps://global-live.mux.com/app'
  const displayStreamKey = streamKey

  const handleCopyKey = async () => {
    if (!hasCredentials) {
      toast.error('OBS credentials are not ready yet. Please regenerate stream credentials.')
      return
    }
    try {
      await navigator.clipboard.writeText(displayStreamKey!)
      setCopiedKey(true)
      toast.success('OBS stream key copied')
      setTimeout(() => setCopiedKey(false), 2000)
    } catch {
      toast.error('Failed to copy stream key')
    }
  }

  const handleCopyUrl = async () => {
    if (!hasCredentials) {
      toast.error('OBS credentials are not ready yet. Please regenerate stream credentials.')
      return
    }
    try {
      await navigator.clipboard.writeText(displayRtmpUrl)
      setCopiedUrl(true)
      toast.success('RTMP URL copied')
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      toast.error('Failed to copy RTMP URL')
    }
  }

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-slate-950/90 p-5 shadow-2xl shadow-black/30">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300 ring-1 ring-purple-400/20">
          <MonitorPlay size={20} />
        </div>

        <div>
          <h3 className="text-base font-black text-white">
            OBS Streaming Setup
          </h3>

<p className="text-xs text-slate-400">
             Professional gaming broadcasts powered by OBS + Custom RTMP
           </p>
        </div>
      </div>

      {/* Warning */}
      <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-amber-400"
          />

          <div>
            <p className="text-sm font-bold text-amber-200">
              Browser screen share has been removed
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-100/70">
              OBS provides significantly better performance, lower battery usage,
              higher quality gaming streams, better audio routing, overlays,
              alerts, webcam scenes, and stable long-duration broadcasting.
            </p>
          </div>
        </div>
      </div>

{/* Stream Info */}
       <div className="mb-5 grid gap-4">
         {/* RTMP URL */}
         <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
           <div className="mb-2 flex items-center justify-between">
             <div>
               <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                 RTMP Server URL
               </p>

<p className="mt-1 text-sm font-medium text-white">
                  Global RTMP Ingest
                </p>
             </div>

<button
                type="button"
                onClick={handleCopyUrl}
                disabled={!hasCredentials}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
           </div>

           <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40 px-3 py-2">
             <code className="block overflow-x-auto whitespace-nowrap text-xs text-cyan-300">
               {hasCredentials ? displayRtmpUrl : 'OBS credentials are not ready yet. Please regenerate stream credentials.'}
             </code>
           </div>
         </div>

         {/* Stream Key */}
         <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
           <div className="mb-2 flex items-center justify-between">
             <div>
               <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                 Stream Key
               </p>

               <p className="mt-1 text-sm font-medium text-white">
                 {streamTitle || 'Gaming Stream'}
               </p>
             </div>

<button
                type="button"
                onClick={handleCopyKey}
                disabled={!hasCredentials}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
           </div>

           <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40 px-3 py-2">
             <code className="block overflow-x-auto whitespace-nowrap text-xs text-green-300">
               {hasCredentials ? displayStreamKey : 'OBS credentials are not ready yet. Please regenerate stream credentials.'}
             </code>
           </div>
         </div>
       </div>

      {/* OBS Setup Steps */}
      <div className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio size={16} className="text-cyan-300" />

          <p className="text-sm font-bold text-cyan-100">
            OBS Configuration
          </p>
        </div>

        <div className="space-y-3 text-xs leading-5 text-slate-300">
          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-bold text-white">1. Open OBS Studio</p>
            <p className="mt-1 text-slate-400">
              Download OBS if not already installed.
            </p>
          </div>

          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-bold text-white">
              2. Go to Settings → Stream
            </p>

            <p className="mt-1 text-slate-400">
              Service: Custom
            </p>
          </div>

          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-bold text-white">
              3. Paste RTMP URL + Stream Key
            </p>

            <p className="mt-1 text-slate-400">
              Use the credentials shown above.
            </p>
          </div>

          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-bold text-white">
              4. Add Sources
            </p>

            <ul className="mt-2 list-inside list-disc space-y-1 text-slate-400">
              <li>Game Capture</li>
              <li>Display Capture</li>
              <li>Webcam</li>
              <li>Alerts/Overlays</li>
              <li>Microphone</li>
            </ul>
          </div>

          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-bold text-white">
              5. Start Streaming in OBS
            </p>

            <p className="mt-1 text-slate-400">
              Your stream will automatically appear on Troll City.
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Settings */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-white">
            Recommended OBS Settings
          </p>

          <a
            href="https://obsproject.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            OBS Studio
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SettingCard
            title="Resolution"
            value="1920x1080"
          />

          <SettingCard
            title="FPS"
            value="60 FPS"
          />

          <SettingCard
            title="Video Bitrate"
            value="6000–9000 kbps"
          />

          <SettingCard
            title="Encoder"
            value="NVENC / Apple VT / x264"
          />

          <SettingCard
            title="Audio Bitrate"
            value="160–320 kbps"
          />

          <SettingCard
            title="Keyframe Interval"
            value="2 seconds"
          />
        </div>
      </div>
    </div>
  )
}

function SettingCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  )
}

export default GamingSetup