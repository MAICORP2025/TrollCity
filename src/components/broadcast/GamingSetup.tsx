import React from 'react'
import {
  Radio,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  MonitorPlay,
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GamingSetupProps {
  streamTitle?: string
  rtmpUrl?: string | null
  streamKey?: string | null

  /**
   * Local browser camera/mic preview area.
   * Pass your existing preview JSX/video container from SetupPage.
   * This keeps OBS setup hybrid: camera/mic on top, OBS credentials below.
   */
  cameraPreview?: React.ReactNode

  /**
   * Browser device state from SetupPage.
   */
  isCameraEnabled?: boolean
  isMicEnabled?: boolean
  hasCameraTrack?: boolean
  hasMicTrack?: boolean

  /**
   * Optional handlers from SetupPage.
   */
  onToggleCamera?: () => void
  onToggleMic?: () => void
  onGenerateCredentials?: () => void | Promise<void>
  onRegenerateCredentials?: () => void | Promise<void>

  /**
   * OBS/Mux connection status.
   */
  obsStatus?: 'idle' | 'generating' | 'ready' | 'waiting' | 'connected' | 'live' | 'error'
  isGeneratingCredentials?: boolean
  isObsConnected?: boolean
  isLive?: boolean

  /**
   * Optional labels/errors.
   */
  errorMessage?: string | null
  className?: string
}

export function GamingSetup({
  streamTitle,
  rtmpUrl,
  streamKey,
  cameraPreview,
  isCameraEnabled = true,
  isMicEnabled = true,
  hasCameraTrack = false,
  hasMicTrack = false,
  onToggleCamera,
  onToggleMic,
  onGenerateCredentials,
  onRegenerateCredentials,
  obsStatus = 'idle',
  isGeneratingCredentials = false,
  isObsConnected = false,
  isLive = false,
  errorMessage,
  className,
}: GamingSetupProps) {
  const [copiedKey, setCopiedKey] = React.useState(false)
  const [copiedUrl, setCopiedUrl] = React.useState(false)

  const hasCredentials = !!(rtmpUrl && streamKey)
  const displayRtmpUrl = rtmpUrl || 'rtmps://global-live.mux.com/app'
  const displayStreamKey = streamKey || ''

  const resolvedObsStatus = React.useMemo(() => {
    if (isGeneratingCredentials) return 'generating'
    if (isLive) return 'live'
    if (isObsConnected) return 'connected'
    if (hasCredentials && obsStatus === 'idle') return 'ready'
    return obsStatus
  }, [hasCredentials, isGeneratingCredentials, isLive, isObsConnected, obsStatus])

  const statusConfig = React.useMemo(() => {
    switch (resolvedObsStatus) {
      case 'generating':
        return {
          label: 'Generating OBS credentials...',
          detail: 'Troll City is creating your secure RTMP stream key.',
          className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
          dotClassName: 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]',
        }
      case 'ready':
        return {
          label: 'OBS credentials ready',
          detail: 'Paste the server URL and stream key into OBS Studio.',
          className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
          dotClassName: 'bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.9)]',
        }
      case 'waiting':
        return {
          label: 'Waiting for OBS signal',
          detail: 'Start Streaming in OBS and Troll City will detect the feed.',
          className: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
          dotClassName: 'bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.9)]',
        }
      case 'connected':
        return {
          label: 'OBS signal connected',
          detail: 'Mux has detected your OBS stream. Preparing live playback.',
          className: 'border-purple-400/30 bg-purple-500/10 text-purple-100',
          dotClassName: 'bg-purple-300 shadow-[0_0_14px_rgba(216,180,254,0.9)]',
        }
      case 'live':
        return {
          label: 'OBS is LIVE on Troll City',
          detail: 'Your OBS feed is broadcasting. Chat, gifts, and battles stay active.',
          className: 'border-red-400/30 bg-red-500/10 text-red-100',
          dotClassName: 'bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.95)] animate-pulse',
        }
      case 'error':
        return {
          label: 'OBS setup needs attention',
          detail: errorMessage || 'Something went wrong while preparing OBS credentials.',
          className: 'border-red-400/30 bg-red-500/10 text-red-100',
          dotClassName: 'bg-red-300 shadow-[0_0_14px_rgba(248,113,113,0.9)]',
        }
      default:
        return {
          label: 'Generate OBS credentials',
          detail: 'Create a secure RTMP server URL and stream key before opening OBS.',
          className: 'border-white/10 bg-white/[0.04] text-slate-200',
          dotClassName: 'bg-slate-400',
        }
    }
  }, [resolvedObsStatus, errorMessage])

  const handleCopyKey = async () => {
    if (!hasCredentials) {
      toast.error('OBS credentials are not ready yet. Generate stream credentials first.')
      return
    }

    try {
      await navigator.clipboard.writeText(displayStreamKey)
      setCopiedKey(true)
      toast.success('OBS stream key copied')
      setTimeout(() => setCopiedKey(false), 2000)
    } catch {
      toast.error('Failed to copy stream key')
    }
  }

  const handleCopyUrl = async () => {
    if (!hasCredentials) {
      toast.error('OBS credentials are not ready yet. Generate stream credentials first.')
      return
    }

    try {
      await navigator.clipboard.writeText(displayRtmpUrl)
      setCopiedUrl(true)
      toast.success('RTMP server URL copied')
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      toast.error('Failed to copy RTMP server URL')
    }
  }

  const handleGenerate = async () => {
    if (!onGenerateCredentials) {
      toast.error('OBS credential generator is not connected yet.')
      return
    }

    try {
      await onGenerateCredentials()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate OBS credentials')
    }
  }

  const handleRegenerate = async () => {
    if (!onRegenerateCredentials && !onGenerateCredentials) {
      toast.error('OBS credential generator is not connected yet.')
      return
    }

    try {
      if (onRegenerateCredentials) {
        await onRegenerateCredentials()
      } else {
        await onGenerateCredentials?.()
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to regenerate OBS credentials')
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-cyan-400/15 bg-slate-950/95 shadow-2xl shadow-black/40',
        'ring-1 ring-white/5',
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200 ring-1 ring-purple-300/25 shadow-[0_0_20px_rgba(168,85,247,0.18)]">
              <MonitorPlay size={22} />
            </div>

            <div>
              <h3 className="text-base font-black text-white sm:text-lg">
                Hybrid Gaming Broadcast
              </h3>

              <p className="text-xs font-medium text-slate-400">
                Top: camera + mic check. Bottom: OBS RTMP connection.
              </p>
            </div>
          </div>

          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-3 py-2',
              statusConfig.className,
            )}
          >
            <span
              className={cn(
                'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                statusConfig.dotClassName,
              )}
            />

            <div>
              <p className="text-xs font-black uppercase tracking-wide">
                {statusConfig.label}
              </p>
              <p className="mt-0.5 max-w-[24rem] text-[11px] leading-4 opacity-80">
                {statusConfig.detail}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Half/Half Layout */}
      <div className="grid min-h-[680px] grid-rows-[minmax(300px,1fr)_minmax(360px,1fr)] lg:min-h-[760px]">
        {/* TOP HALF: Camera + Mic Preview */}
        <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-black to-slate-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.14),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.10),transparent_34%)]" />

          <div className="relative flex h-full flex-col p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                  Camera + Mic Preview
                </p>
                <h4 className="mt-1 text-xl font-black text-white">
                  {streamTitle || 'Gaming Stream'}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <DevicePill
                  active={hasCameraTrack && isCameraEnabled}
                  activeLabel="Camera Ready"
                  inactiveLabel={hasCameraTrack ? 'Camera Off' : 'No Camera'}
                  activeIcon={<Video size={14} />}
                  inactiveIcon={<VideoOff size={14} />}
                />

                <DevicePill
                  active={hasMicTrack && isMicEnabled}
                  activeLabel="Mic Ready"
                  inactiveLabel={hasMicTrack ? 'Mic Muted' : 'No Mic'}
                  activeIcon={<Mic size={14} />}
                  inactiveIcon={<MicOff size={14} />}
                />
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-cyan-300/15 bg-black/55 shadow-[0_0_35px_rgba(34,211,238,0.10)]">
              {cameraPreview ? (
                cameraPreview
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20">
                    <Camera size={28} />
                  </div>

                  <p className="text-sm font-black text-white">
                    Connect SetupPage camera preview here
                  </p>

                  <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                    Pass your existing preview video/container into <code>cameraPreview</code>.
                    This keeps the broadcaster’s camera and microphone visible while OBS handles the game feed.
                  </p>
                </div>
              )}

              <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-black text-white backdrop-blur-md">
                Local Broadcaster Preview
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-slate-300 backdrop-blur-md">
                  Use this to verify your face cam and mic before starting OBS.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleCamera}
                    disabled={!onToggleCamera}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40',
                      isCameraEnabled
                        ? 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
                        : 'border-red-300/25 bg-red-500/10 text-red-100 hover:bg-red-500/15',
                    )}
                  >
                    {isCameraEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                    {isCameraEnabled ? 'Camera On' : 'Camera Off'}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleMic}
                    disabled={!onToggleMic}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40',
                      isMicEnabled
                        ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                        : 'border-red-300/25 bg-red-500/10 text-red-100 hover:bg-red-500/15',
                    )}
                  >
                    {isMicEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                    {isMicEnabled ? 'Mic On' : 'Mic Muted'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM HALF: OBS RTMP Setup */}
        <section className="overflow-y-auto bg-slate-950 p-4 sm:p-5">
          <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-300"
              />

              <div>
                <p className="text-sm font-black text-amber-100">
                  OBS handles the game feed. Troll City still handles chat, gifts, battles, and overlays.
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-100/75">
                  Use the camera/mic preview above for your broadcaster presence. Use OBS below for game capture,
                  desktop capture, scenes, alerts, and high-performance long-duration streaming.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {!hasCredentials ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGeneratingCredentials}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-400/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingCredentials ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wifi size={16} />
                )}
                {isGeneratingCredentials ? 'Generating...' : 'Generate OBS Credentials'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isGeneratingCredentials}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-300/25 bg-purple-500/15 px-4 py-3 text-sm font-black text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingCredentials ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Regenerate OBS Credentials
              </button>
            )}

            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
              <ShieldCheck size={17} className="shrink-0 text-emerald-300" />
              <p className="text-xs font-semibold leading-5 text-emerald-100/80">
                Stream keys must come from the backend/Mux function. Never expose Mux secrets in frontend.
              </p>
            </div>
          </div>

          {/* Stream Info */}
          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <CredentialCard
              title="RTMP Server URL"
              subtitle="OBS → Settings → Stream → Server"
              value={hasCredentials ? displayRtmpUrl : 'Generate OBS credentials first'}
              valueClassName="text-cyan-300"
              copied={copiedUrl}
              disabled={!hasCredentials}
              onCopy={handleCopyUrl}
            />

            <CredentialCard
              title="Stream Key"
              subtitle={streamTitle || 'Gaming Stream'}
              value={hasCredentials ? displayStreamKey : 'Generate OBS credentials first'}
              valueClassName="text-green-300"
              copied={copiedKey}
              disabled={!hasCredentials}
              onCopy={handleCopyKey}
            />
          </div>

          {/* OBS Setup Steps */}
          <div className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Radio size={16} className="text-cyan-300" />

              <p className="text-sm font-black text-cyan-100">
                OBS Configuration
              </p>
            </div>

            <div className="grid gap-3 text-xs leading-5 text-slate-300 md:grid-cols-2">
              <StepCard
                number="1"
                title="Open OBS Studio"
                description="Install OBS Studio on your computer if you have not already."
              />

              <StepCard
                number="2"
                title="Go to Settings → Stream"
                description="Set Service to Custom."
              />

              <StepCard
                number="3"
                title="Paste RTMP URL + Stream Key"
                description="Use the exact credentials shown above."
              />

              <StepCard
                number="4"
                title="Add Game Sources"
                description="Use Game Capture, Display Capture, Webcam, Alerts, Overlays, and Microphone."
              />

              <StepCard
                number="5"
                title="Start Streaming in OBS"
                description="Troll City will show Waiting for OBS Signal until Mux confirms the feed."
              />

              <StepCard
                number="6"
                title="Keep Troll City Open"
                description="Chat, gifts, battles, moderation, and host controls stay inside Troll City."
              />
            </div>
          </div>

          {/* Recommended Settings */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black text-white">
                Recommended OBS Settings
              </p>

              <a
                href="https://obsproject.com/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200"
              >
                OBS Studio
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SettingCard title="Resolution" value="1280x720 launch default" />
              <SettingCard title="FPS" value="30 FPS / 60 FPS optional" />
              <SettingCard title="Video Bitrate" value="3500–6000 kbps" />
              <SettingCard title="Rate Control" value="CBR" />
              <SettingCard title="Encoder" value="NVENC / Apple VT / x264" />
              <SettingCard title="Audio Bitrate" value="160–320 kbps" />
              <SettingCard title="Keyframe Interval" value="2 seconds" />
              <SettingCard title="Service" value="Custom" />
              <SettingCard title="Server" value="RTMP Server URL above" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function CredentialCard({
  title,
  subtitle,
  value,
  valueClassName,
  copied,
  disabled,
  onCopy,
}: {
  title: string
  subtitle: string
  value: string
  valueClassName?: string
  copied: boolean
  disabled?: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            {title}
          </p>

          <p className="mt-1 text-sm font-semibold text-white">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onCopy}
          disabled={disabled}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/45 px-3 py-2">
        <code
          className={cn(
            'block overflow-x-auto whitespace-nowrap text-xs',
            valueClassName || 'text-cyan-300',
          )}
        >
          {value}
        </code>
      </div>
    </div>
  )
}

function DevicePill({
  active,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
  activeIcon: React.ReactNode
  inactiveIcon: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-black sm:inline-flex',
        active
          ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
          : 'border-red-300/25 bg-red-500/10 text-red-100',
      )}
    >
      {active ? activeIcon : inactiveIcon}
      {active ? activeLabel : inactiveLabel}
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-200 ring-1 ring-cyan-300/20">
          {number}
        </div>

        <div>
          <p className="font-black text-white">{title}</p>
          <p className="mt-1 text-slate-400">{description}</p>
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
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  )
}

export default GamingSetup
