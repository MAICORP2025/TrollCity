import React from 'react'
import { RTLS_PLAYER_URL } from '@/lib/config'
import {
  AlertTriangle,
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Gamepad2,
  ImageIcon,
  Loader2,
  Mail,
  Mic,
  MicOff,
  MonitorPlay,
  MoreVertical,
  Power,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smile,
  Video,
  VideoOff,
  Wifi,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'


type ObsStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'waiting'
  | 'connected'
  | 'live'
  | 'error'
  | 'reconnecting'
  | 'gateway_not_configured'

interface GamingSetupProps {
  streamTitle?: string
  onStreamTitleChange?: (title: string) => void
  rtmpUrl?: string | null
  streamKey?: string | null
  agoraChannel?: string | null
  gameTitle?: string
  onGameChange?: (game: string) => void

  isCameraEnabled?: boolean
  isMicEnabled?: boolean
  hasCameraTrack?: boolean
  hasMicTrack?: boolean

  onToggleCamera?: () => void
  onToggleMic?: () => void

  onGenerateCredentials?: () => void | Promise<void>
  onRegenerateCredentials?: () => void | Promise<void>

  onGoLive?: () => void | Promise<void>
  onTestStream?: () => void | Promise<void>

  obsStatus?: ObsStatus
  isGeneratingCredentials?: boolean
  isObsConnected?: boolean
  isLive?: boolean

  errorMessage?: string | null
  className?: string
  viewerCount?: number
  streamDuration?: string
  bitrate?: string
  streamHealth?: string
  username?: string
  userLevel?: number
  userAvatar?: string | null

  cameraPreview?: React.ReactNode

  chatPanel?: React.ReactNode
  saveBroadcastButton?: React.ReactNode
  onEndStream?: () => void | Promise<void>
}

export function GamingSetup({
  streamTitle = 'Ranked Grind to Top 1 | Troll City',
  rtmpUrl,
  streamKey,
  isCameraEnabled = true,
  isMicEnabled = true,
  hasCameraTrack = false,
  hasMicTrack = false,
  onToggleCamera,
  onToggleMic,
  onGenerateCredentials,
  onRegenerateCredentials,
  onGoLive,
  onTestStream,
  obsStatus = 'idle',
  isGeneratingCredentials = false,
  isObsConnected = false,
  isLive = false,
  errorMessage,
  className,
  viewerCount = 0,
  streamDuration = '00:00:00',
  bitrate = '0 kbps',
  streamHealth = 'Good',
  username = 'Gamer',
  userLevel = 1,
  userAvatar = null,
  cameraPreview,
  chatPanel,
  saveBroadcastButton,
  onEndStream,
}: GamingSetupProps) {
  const [copiedUrl, setCopiedUrl] = React.useState(false)
  const [copiedKey, setCopiedKey] = React.useState(false)
  const [showCredentials, setShowCredentials] = React.useState(true)
  const [showGameSearch, setShowGameSearch] = React.useState(false)
  const [gameSearchQuery, setGameSearchQuery] = React.useState('')
  const [selectedGame, setSelectedGame] = React.useState<string>('')

  const POPULAR_GAMES = [
    'Fortnite', 'Apex Legends', 'Call of Duty: Warzone', 'Valorant', 'League of Legends',
    'Counter-Strike 2', 'Dota 2', 'Overwatch 2', 'Rocket League', 'Fall Guys',
    'Grand Theft Auto V', 'Red Dead Redemption 2', 'Elden Ring', 'Cyberpunk 2077',
    'The Witcher 3', 'World of Warcraft', 'Final Fantasy XIV', 'Destiny 2', 'Rainbow Six Siege',
    'SplitGate', 'Halo Infinite', 'Call of Duty: Modern Warfare II', 'Apex Legends Mobile',
    'PUBG', 'ARMA 3', 'Escape from Tarkov', 'Dead by Daylight', 'Among Us',
    'Fall Guys', 'Brawlhalla', 'Super Smash Bros. Ultimate', 'Street Fighter 6', 'Mortal Kombat 1',
    'FIFA 24', 'NBA 2K24', 'Madden NFL 24', 'Rocket League', 'F1 23'
  ]

  const filteredGames = React.useMemo(() => {
    if (!gameSearchQuery) return POPULAR_GAMES.slice(0, 15)
    return POPULAR_GAMES.filter(g => g.toLowerCase().includes(gameSearchQuery.toLowerCase())).slice(0, 10)
  }, [gameSearchQuery])

  const hasCredentials = Boolean(rtmpUrl && streamKey)

  const resolvedStatus: ObsStatus = React.useMemo(() => {
    if (isGeneratingCredentials) return 'generating'
    if (isLive) return 'live'
    if (isObsConnected) return 'connected'
    if (obsStreaming && hasCredentials) return 'connected'
    if (hasCredentials && obsStatus === 'idle') return 'ready'
    return obsStatus
  }, [hasCredentials, isGeneratingCredentials, isLive, isObsConnected, obsStatus, obsStreaming])

  const status = React.useMemo(
    () => getObsStatusConfig(resolvedStatus, errorMessage),
    [resolvedStatus, errorMessage],
  )

  const canGoLive = hasCredentials && (isObsConnected || resolvedStatus === 'connected' || resolvedStatus === 'live')

  const copyToClipboard = async (
    value: string | null | undefined,
    label: string,
    setCopied: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (!value) {
      toast.error(`${label} is not ready yet. Generate stream credentials first.`)
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(`Failed to copy ${label}`)
    }
  }

  const handleGenerate = async () => {
    if (!onGenerateCredentials) {
      toast.error('OBS credential generator is not wired to SetupPage yet.')
      return
    }

    try {
      await onGenerateCredentials()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate OBS stream key')
    }
  }

  const handleRegenerate = async () => {
    const handler = onRegenerateCredentials || onGenerateCredentials

    if (!handler) {
      toast.error('OBS credential generator is not wired to SetupPage yet.')
      return
    }

    try {
      await handler()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to regenerate OBS stream key')
    }
  }

  const handleGoLive = async () => {
    if (!hasCredentials) {
      toast.error('Generate your OBS stream key first.')
      return
    }

    if (!canGoLive && !onGoLive) {
      toast.error('Start streaming in OBS first, then Troll City will detect the signal.')
      return
    }

    if (!onGoLive) {
      toast.success('OBS is connected. You are ready to go live.')
      return
    }

    try {
      await onGoLive()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start live broadcast')
    }
  }

  const handleTestStream = async () => {
    if (!onTestStream) {
      toast.info('Test stream handler is not connected yet.')
      return
    }

    try {
      await onTestStream()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to run test stream')
    }
  }

  return (
    <div
      className={cn(
        'min-h-screen overflow-hidden bg-[#05080f] text-white',
        'bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.12),transparent_30%),linear-gradient(180deg,#05080f,#02040a)]',
        className,
      )}
    >
      {/* Top Navigation */}
      <header className="border-b border-cyan-400/15 bg-black/35 px-4 py-3 backdrop-blur-2xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.22)]">
                <Gamepad2 className="h-6 w-6 text-cyan-200" />
              </div>

              <div className="leading-none">
                <div className="text-2xl font-black italic tracking-tight">
                  <span className="text-cyan-300">Troll</span>{' '}
                  <span className="bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">
                    City
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-2.5 text-sm font-black text-emerald-200 shadow-[0_0_24px_rgba(74,222,128,0.18)] md:flex md:items-center md:gap-2">
              <Gamepad2 className="h-4 w-4" />
              Gaming
            </div>

          </div>

          <div className="hidden items-center gap-3 rounded-2xl border border-cyan-400/15 bg-white/[0.04] px-3 py-2 md:flex">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={username}
                className="h-10 w-10 rounded-xl border border-purple-300/40 object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-purple-300/40 bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black">
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-black">{username}</p>
              <p className="text-xs font-bold text-cyan-300">LVL {userLevel}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[360px_minmax(560px,1fr)_360px] 2xl:grid-cols-[420px_minmax(680px,1fr)_420px]">
        {/* Left Column */}
        <section className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader
              icon={<Camera className="h-4 w-4" />}
              title="Host Camera + Mic"
              right={
                <div className="flex items-center gap-2">
                  <button className="text-cyan-300 hover:text-cyan-100">
                    <MonitorPlay className="h-4 w-4" />
                  </button>
                  <button className="text-slate-400 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              }
            />

            <div className="relative h-[280px] overflow-hidden bg-black sm:h-[320px] xl:h-[300px] 2xl:h-[330px]">
              {cameraPreview ? (
                cameraPreview
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_70%_30%,rgba(168,85,247,0.18),transparent_32%)] px-6 text-center">
                  <div className="mb-4 grid h-20 w-20 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10">
                    <Camera className="h-9 w-9 text-cyan-200" />
                  </div>
                  <p className="text-sm font-black">Connect host preview here</p>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
                    Pass SetupPage camera video into <code>cameraPreview</code>.
                  </p>
                </div>
              )}

              <div className="absolute bottom-4 left-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  disabled={!onToggleCamera}
                  className={cn(
                    'grid h-11 w-11 place-items-center rounded-xl border text-white transition disabled:opacity-40',
                    isCameraEnabled
                      ? 'border-cyan-300/30 bg-cyan-400/10 hover:bg-cyan-400/15'
                      : 'border-red-300/30 bg-red-500/10 hover:bg-red-500/15',
                  )}
                >
                  {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={onToggleMic}
                  disabled={!onToggleMic}
                  className={cn(
                    'grid h-11 w-11 place-items-center rounded-xl border text-white transition disabled:opacity-40',
                    isMicEnabled
                      ? 'border-emerald-300/30 bg-emerald-400/10 hover:bg-emerald-400/15'
                      : 'border-red-300/30 bg-red-500/10 hover:bg-red-500/15',
                  )}
                >
                  {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
              </div>

              <div className="absolute bottom-5 right-4 flex items-center gap-2">
                <div className="text-[10px] font-black uppercase text-slate-300">
                  Mic Level
                </div>
                <AudioBars active={hasMicTrack && isMicEnabled} />
                <div
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    hasMicTrack && isMicEnabled ? 'bg-emerald-400' : 'bg-red-400',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-black uppercase',
                    hasMicTrack && isMicEnabled ? 'text-emerald-300' : 'text-red-300',
                  )}
                >
                  {hasMicTrack && isMicEnabled ? 'Good' : 'Off'}
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader icon={<Swords className="h-4 w-4" />} title="Battle Summary" />

            <div className="space-y-4 p-4">
              {battlePhase !== 'idle' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-white/10 bg-black/40 p-4 text-center">
                      <p className="text-xs uppercase text-slate-500">You</p>
                      <p className="mt-3 text-2xl font-black text-cyan-300">{battleMyScore.toLocaleString()}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/40 p-4 text-center">
                      <p className="text-xs uppercase text-slate-500">Opponent</p>
                      <p className="mt-3 text-2xl font-black text-purple-300">{battleOpponentScore.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="rounded-full bg-white/5 h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                      style={{
                        width:
                          battleMyScore + battleOpponentScore > 0
                            ? `${Math.round((battleMyScore / (battleMyScore + battleOpponentScore)) * 100)}%`
                            : '50%',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs uppercase text-slate-500">
                    <span>{battlePhase === 'active' ? 'Battle in progress' : `${battlePhase.charAt(0).toUpperCase()}${battlePhase.slice(1)}`}</span>
                    <span>{battleTimeRemaining}</span>
                  </div>
                  {battleOpponentUsername ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                      {battleOpponentAvatar ? (
                        <img src={battleOpponentAvatar} alt={battleOpponentUsername} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-xs font-black text-slate-400">?
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-black text-white">{battleOpponentUsername}</p>
                        <p className="text-xs text-slate-400">Opponent</p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-400">No active battle at the moment.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader icon={<Settings className="h-4 w-4" />} title="Stream Settings" />

            <div className="divide-y divide-white/10 p-4">
              <div className="pb-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wide">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => onStreamTitleChange?.(e.target.value)}
                  placeholder="Enter stream title..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/50"
                />
              </div>

              <div className="pt-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wide">Game</label>
                <div className="mt-2 relative">
                  <button
                    type="button"
                    onClick={() => setShowGameSearch(!showGameSearch)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium text-white flex items-center justify-between text-left"
                  >
                    <span>{selectedGame || 'Select a game...'}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {showGameSearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#07111d] shadow-2xl z-50 max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-white/10">
                        <input
                          type="text"
                          value={gameSearchQuery}
                          onChange={(e) => setGameSearchQuery(e.target.value)}
                          placeholder="Search games..."
                          className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
                        />
                      </div>
                      <div className="p-2">
                        {filteredGames.map((game) => (
                          <button
                            key={game}
                            type="button"
                            onClick={() => {
                              setSelectedGame(game)
                              onGameChange?.(game)
                              setShowGameSearch(false)
                            }}
                            className="w-full rounded-lg px-3 py-2 text-sm text-left text-white hover:bg-white/10 transition-colors"
                          >
                            {game}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <SettingRow label="Quality" value="1080p60" />
              <SettingRow label="Latency" value="Low (2–3s)" />
              <div className="py-3">
                {saveBroadcastButton || (
                  <SettingRow
                    label="Save Broadcast"
                    value={
                      <div className="h-6 w-11 rounded-full bg-slate-600 p-1">
                        <div className="h-4 w-4 rounded-full bg-white/50" />
                      </div>
                    }
                  />
                )}
              </div>
            </div>
          </Panel>
        </section>

        {/* Center Column */}
        <section className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader
              icon={<MonitorPlay className="h-4 w-4" />}
              title="Game / OBS Preview"
              right={
                <div className="flex items-center gap-3 text-xs font-black">
                  <span className="rounded-lg bg-cyan-400/10 px-2 py-1 text-cyan-200">
                    1080p60
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-slate-300">
                    60 FPS
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {isLive ? 'LIVE' : isObsConnected ? 'READY' : 'OFFLINE'}
                  </span>
                </div>
              }
            />

            <div className="relative aspect-video overflow-hidden bg-black">
              {isLive && streamKey && RTLS_PLAYER_URL ? (
                <GamingLivePlayer streamKey={streamKey} />
              ) : isLive && streamKey ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-900">
                  <p className="text-slate-400 text-sm">Live streaming - viewers see your stream</p>
                </div>
              ) : (
                <GamePreviewPlaceholder
                  isObsConnected={isObsConnected}
                  hasCredentials={hasCredentials}
                />
              )}

              {battleOverlay}

              <div className="absolute left-5 top-5 h-24 w-24 rounded-full border border-cyan-300/20 bg-black/55 p-2 backdrop-blur-xl">
                <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.28),rgba(2,6,23,0.95))]" />
              </div>


              <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={username}
                    className="h-11 w-11 rounded-xl border border-purple-300/30 object-cover"
                  />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-purple-300/30 bg-purple-500/20 text-xs font-black">
                    {username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-black uppercase">{username}</p>
                  <div className="mt-1 h-2 w-40 rounded-full bg-white/15">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
                  </div>
                </div>
                <span className="text-xs font-black">100 / 100</span>
              </div>

              <div className="absolute bottom-5 right-5 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xl font-black backdrop-blur-xl">
                30<span className="text-sm text-slate-400"> / 120</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/30 p-4">
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.08]"
              >
                Edit Overlays
              </button>

              <div className="flex items-center gap-2">
                {[Settings, Camera, MonitorPlay, Smile, ImageIcon].map((Icon, index) => (
                  <button
                    key={index}
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-400/15"
              >
                Overlay Studio
              </button>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel>
              <PanelHeader icon={<Radio className="h-4 w-4" />} title="OBS Connection" />

              <div className="p-4">
                <div className="grid gap-4 md:grid-cols-[170px_1fr]">
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div
                      className={cn(
                        'relative grid h-24 w-24 place-items-center rounded-full border bg-black',
                        hasCredentials
                          ? 'border-emerald-400/40 shadow-[0_0_30px_rgba(74,222,128,0.20)]'
                          : 'border-slate-600',
                      )}
                    >
                      <MonitorPlay
                        className={cn(
                          'h-10 w-10',
                          hasCredentials ? 'text-emerald-300' : 'text-slate-500',
                        )}
                      />
                      {hasCredentials && (
                        <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        'mt-4 text-sm font-black uppercase',
                        isLive
                          ? 'text-red-300'
                          : isObsConnected
                            ? 'text-emerald-300'
                            : hasCredentials
                              ? 'text-cyan-300'
                              : 'text-slate-400',
                      )}
                    >
                      {isLive
                        ? 'Live'
                        : isObsConnected
                          ? 'OBS Linked'
                          : hasCredentials
                            ? 'Key Ready'
                            : 'Not Linked'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className={cn('rounded-2xl border px-4 py-3', status.className)}>
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                            status.dotClassName,
                          )}
                        />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide">
                            {status.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 opacity-80">
                            {status.detail}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {!hasCredentials ? (
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={isGeneratingCredentials}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/15 px-3 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50"
                        >
                          {isGeneratingCredentials ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wifi className="h-4 w-4" />
                          )}
                          Generate Key
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          disabled={isGeneratingCredentials}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-300/25 bg-purple-500/15 px-3 py-2.5 text-xs font-black text-purple-100 transition hover:bg-purple-500/20 disabled:opacity-50"
                        >
                          {isGeneratingCredentials ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Regenerate
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowCredentials((value) => !value)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-black text-slate-200 transition hover:bg-white/[0.08]"
                      >
                        {showCredentials ? 'Hide Keys' : 'Show Keys'}
                      </button>
                    </div>
                  </div>
                </div>

                {showCredentials && (
                  <div className="mt-4 grid gap-3">
                    <CredentialRow
                      label="Server URL"
                      value={rtmpUrl || 'Generate stream key first'}
                      copied={copiedUrl}
                      disabled={!rtmpUrl}
                      onCopy={() => copyToClipboard(rtmpUrl, 'Server URL', setCopiedUrl)}
                    />
                    <CredentialRow
                      label="Stream Key"
                      value={streamKey || 'Generate stream key first'}
                      copied={copiedKey}
                      disabled={!streamKey}
                      maskValue={Boolean(streamKey)}
                      onCopy={() => copyToClipboard(streamKey, 'Stream Key', setCopiedKey)}
                    />

                  </div>
                )}
              </div>
            </Panel>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoLive}
                className={cn(
                  'relative flex h-[150px] w-full items-center justify-center overflow-hidden rounded-3xl border text-4xl font-black uppercase tracking-wide transition',
                  canGoLive
                    ? 'border-cyan-200/50 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-[0_0_45px_rgba(59,130,246,0.45)] hover:scale-[1.01]'
                    : 'border-slate-700 bg-slate-900/70 text-slate-500',
                )}
              >
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.25),transparent_36%)]" />
                <span className="relative flex items-center gap-3">
                  Go Live
                  <Radio className="h-9 w-9" />
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestStream}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 transition hover:bg-white/[0.08]"
              >
                <ShieldCheck className="h-4 w-4" />
                Test Stream
              </button>

              {onEndStream && (isLive || isObsConnected) && (
                <button
                  type="button"
                  onClick={onEndStream}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-xs font-black text-red-200 transition hover:bg-red-500/20"
                >
                  <Power className="h-4 w-4" />
                  End Stream
                </button>
              )}
            </div>
          </div>

        </section>

        {/* Right Column */}
        <section className="space-y-4">
          <Panel className="flex flex-col" style={{ maxHeight: 380 }}>
            <PanelHeader
              icon={<Mail className="h-4 w-4" />}
              title="Chat"
              right={<CounterBadge value="Live" />}
            />

            <div className="min-h-0 flex-1 overflow-hidden p-2">
              {chatPanel || (
                <p className="py-4 text-center text-xs text-slate-500">Connect stream to enable chat</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<Gift className="h-4 w-4" />}
              title="Gaming Gifts"
              right={<CounterBadge value="GG" />}
            />

            <div className="p-3">
              {giftPanel || (
                <p className="py-4 text-center text-xs text-slate-500">Connect stream to send gifts</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<Swords className="h-4 w-4" />}
              title="Battle"
              right={battlePhase !== 'idle' ? (
                <span className="rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-black text-white">
                  {battlePhase === 'active' ? 'LIVE' : battlePhase.toUpperCase()}
                </span>
              ) : null}
            />

            <div className="p-4">
              {battlePhase === 'idle' ? (
                <div className="text-center">
                  <Swords className="mx-auto h-8 w-8 text-purple-400/60" />
                  <p className="mt-2 text-xs font-bold text-slate-400">Start a gaming battle</p>
                  <p className="mt-1 text-[10px] text-slate-500">5-min timer, gift scoring, no stream merge</p>
                  <button
                    onClick={onBattleStart}
                    className="mt-4 w-full rounded-xl border border-purple-300/25 bg-purple-500/15 px-4 py-2.5 text-xs font-black text-purple-100 transition hover:bg-purple-500/25"
                  >
                    <Swords className="mr-1.5 inline h-3.5 w-3.5" />
                    Find Opponent
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-black">
                    <div>
                      <p className="text-cyan-300">You</p>
                      <p className="text-2xl text-cyan-300">{battleMyScore.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <Swords className="mx-auto h-5 w-5 text-purple-400" />
                      <p className="text-xs text-slate-500">VS</p>
                      <div className="flex items-center gap-1 text-amber-300">
                        <Clock className="h-3 w-3" />
                        <span className="font-mono text-sm">
                          {Math.floor(battleTimeRemaining / 60)}:{(battleTimeRemaining % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-purple-300">{battleOpponentUsername || '???'}</p>
                      <p className="text-2xl text-purple-300">{battleOpponentScore.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{ width: `${(battleMyScore / (battleMyScore + battleOpponentScore || 1)) * 100}%` }}
                    />
                  </div>
                  {battlePhase === 'active' && (
                    <button
                      onClick={onBattleEnd}
                      className="w-full rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 transition hover:bg-red-500/20"
                    >
                      End Battle
                    </button>
                  )}
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<MonitorPlay className="h-4 w-4" />}
              title="OBS Scenes"
              right={<CounterBadge value={String(obsScenes.length)} />}
            />

            <div className="grid grid-cols-4 gap-2 p-4">
              {obsConnected ? (
                <>
                  {obsScenes.map((scene) => (
                    <button
                      key={scene.name}
                      onClick={() => onSwitchScene?.(scene.name)}
                      className={cn(
                        'min-h-[64px] rounded-xl border bg-black/25 p-2 text-[10px] font-black transition',
                        scene.isActive
                          ? 'border-cyan-300/50 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                          : 'border-white/10 text-slate-400 hover:text-white',
                      )}
                    >
                      <div className="mb-2 h-7 rounded-lg bg-gradient-to-br from-cyan-400/20 to-purple-500/20" />
                      {scene.name}
                    </button>
                  ))}
                  <button className="grid min-h-[64px] place-items-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] text-slate-400 hover:text-cyan-200">
                    <Plus className="h-6 w-6" />
                  </button>
                </>
              ) : (
                <div className="col-span-4 text-center">
                  <MonitorPlay className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-2 text-xs text-slate-500">Connect OBS to switch scenes</p>
                  <button
                    onClick={() => onObsConnect?.()}
                    disabled={obsConnecting}
                    className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50"
                  >
                    {obsConnecting ? (
                      <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Connecting...</>
                    ) : (
                      <><Plug className="mr-1 inline h-3 w-3" />Connect OBS</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<BarChart3 className="h-4 w-4" />}
              title="Stream Status"
              right={
                <span className="flex items-center gap-1 text-xs font-black text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {isLive ? 'LIVE' : isObsConnected ? 'READY' : 'OFFLINE'}
                </span>
              }
            />

            <div className="grid grid-cols-4 gap-2 p-4 text-center">
              <StatusMetric label="Viewers" value={viewerCount.toLocaleString()} />
              <StatusMetric label="Duration" value={streamDuration} />
              <StatusMetric label="Bitrate" value={bitrate} />
              <StatusMetric label="Health" value={streamHealth} good={streamHealth === 'Good' || streamHealth === 'Excellent'} />
            </div>
          </Panel>
        </section>
      </main>

      {/* Mobile OBS Instructions */}
      <section className="px-4 pb-6 sm:px-6 xl:hidden">
        <ObsInstructions />
      </section>
    </div>
  )
}

function getObsStatusConfig(status: ObsStatus, errorMessage?: string | null) {
  switch (status) {
    case 'generating':
      return {
        label: 'Generating Stream Key',
        detail: 'Troll City is creating secure OBS credentials for this gaming stream.',
        className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
        dotClassName: 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]',
      }

    case 'ready':
      return {
        label: 'Stream Key Ready',
        detail: 'Copy the Server URL and Stream Key into OBS Studio.',
        className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
        dotClassName: 'bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.9)]',
      }

    case 'waiting':
      return {
        label: 'Waiting for OBS Signal',
        detail: 'Click Start Streaming in OBS. Troll City will detect the incoming feed.',
        className: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
        dotClassName: 'bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.9)]',
      }

    case 'connected':
      return {
        label: 'OBS Signal Connected',
        detail: 'Your stream provider detected the OBS feed. You are ready to go live.',
        className: 'border-purple-400/30 bg-purple-500/10 text-purple-100',
        dotClassName: 'bg-purple-300 shadow-[0_0_14px_rgba(216,180,254,0.9)]',
      }

    case 'live':
      return {
        label: 'Live on Troll City',
        detail: 'Your OBS gaming feed is broadcasting. Chat, gifts, and battles stay active.',
        className: 'border-red-400/30 bg-red-500/10 text-red-100',
        dotClassName: 'bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.95)] animate-pulse',
      }

    case 'reconnecting':
      return {
        label: 'Reconnecting to OBS',
        detail: 'OBS signal was lost. Attempting to reconnect...',
        className: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
        dotClassName: 'bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.9)] animate-pulse',
      }

    case 'error':
      return {
        label: 'OBS Setup Error',
        detail: errorMessage || 'Something went wrong while preparing the OBS stream key.',
        className: 'border-red-400/30 bg-red-500/10 text-red-100',
        dotClassName: 'bg-red-300 shadow-[0_0_14px_rgba(248,113,113,0.9)]',
      }

    case 'gateway_not_configured':
      return {
        label: 'Agora Media Gateway Not Configured',
        detail: errorMessage || 'The streaming server is not set up yet. Please contact Troll City support.',
        className: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
        dotClassName: 'bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.9)]',
      }

    case 'idle':
    default:
      return {
        label: 'Generate Stream Key',
        detail: 'Create a private OBS stream key before opening OBS Studio.',
        className: 'border-white/10 bg-white/[0.04] text-slate-200',
        dotClassName: 'bg-slate-400',
      }
  }
}

function Panel({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        'rounded-2xl border border-cyan-400/20 bg-[#07111d]/82 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PanelHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-cyan-400/15 px-4 py-3">
      <div className="flex items-center gap-2 text-cyan-300">
        {icon}
        <h3 className="text-sm font-black uppercase tracking-wide">{title}</h3>
      </div>
      {right}
    </div>
  )
}

function IconButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200',
        className,
      )}
    >
      {children}
    </button>
  )
}

function AudioBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px]">
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-full',
            index < 15 && active
              ? 'bg-emerald-400'
              : index < 20 && active
                ? 'bg-yellow-300'
                : index < 22 && active
                  ? 'bg-orange-400'
                  : active
                    ? 'bg-red-400/45'
                    : 'bg-slate-700',
          )}
          style={{ height: `${6 + (index % 8) * 2}px` }}
        />
      ))}
    </div>
  )
}

function MixerRow({ label, level }: { label: string; level: number }) {
  return (
    <div className="grid grid-cols-[100px_1fr_28px] items-center gap-3">
      <span className="text-xs font-semibold text-slate-300">{label}</span>

      <div className="flex items-center gap-3">
        <div className="flex w-20 items-end gap-[2px]">
          {Array.from({ length: 16 }).map((_, index) => (
            <span
              key={index}
              className={cn(
                'w-[3px] rounded-full',
                index < Math.round((level / 100) * 16) ? 'bg-emerald-400' : 'bg-slate-700',
              )}
              style={{ height: `${8 + (index % 6) * 2}px` }}
            />
          ))}
        </div>

        <div className="relative h-1.5 flex-1 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400"
            style={{ width: `${level}%` }}
          />
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]"
            style={{ left: `calc(${level}% - 8px)` }}
          />
        </div>
      </div>

      <Mic className="h-4 w-4 text-slate-300" />
    </div>
  )
}

function SettingRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="text-slate-300">{label}</span>
      <div className="max-w-[65%] truncate text-right font-semibold text-slate-200">
        {value}
      </div>
    </div>
  )
}

function GamePreviewPlaceholder({
  isObsConnected,
  hasCredentials,
}: {
  isObsConnected: boolean
  hasCredentials: boolean
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#07111d,#111827_45%,#150b2e)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(34,211,238,0.26),transparent_24%),radial-gradient(circle_at_80%_50%,rgba(168,85,247,0.24),transparent_32%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-[2rem] border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.16)]">
            <MonitorPlay className="h-12 w-12 text-cyan-200" />
          </div>

          <p className="text-2xl font-black">
            {isObsConnected
              ? 'OBS preview is connected'
              : hasCredentials
                ? 'Start streaming from OBS'
                : 'Generate an OBS stream key'}
          </p>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
            {isObsConnected
              ? 'Your OBS signal is live and ready for preview.'
              : hasCredentials
                ? 'Copy the Server URL and Stream Key into OBS, then start streaming.'
                : 'Create OBS credentials to connect your game feed.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function CredentialRow({
  label,
  value,
  copied,
  disabled,
  maskValue = false,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  disabled?: boolean
  maskValue?: boolean
  onCopy: () => void
}) {
  const displayValue =
    maskValue && value && value !== 'Generate stream key first'
      ? `${value.slice(0, 12)}••••••••••••••••`
      : value

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <button
          type="button"
          onClick={onCopy}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black text-white transition hover:bg-white/[0.08] disabled:opacity-40"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <code className="block overflow-x-auto whitespace-nowrap text-xs text-cyan-200">
        {displayValue}
      </code>
    </div>
  )
}


function ChatLine({
  name,
  color,
  text,
}: {
  name: string
  color: string
  text: string
}) {
  return (
    <p>
      <span className={cn('font-black', color)}>{name}:</span>{' '}
      <span className="text-slate-300">{text}</span>
    </p>
  )
}

function CounterBadge({ value }: { value: string }) {
  return (
    <span className="rounded-lg bg-purple-600 px-2 py-1 text-[10px] font-black text-white">
      {value}
    </span>
  )
}

function GiftButton({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <button className="rounded-xl border border-white/10 bg-black/25 p-3 text-center transition hover:border-cyan-300/30">
      <div className="text-2xl font-black">{icon}</div>
      <p className="mt-2 text-xs font-black text-white">{label}</p>
      <p className="mt-1 text-[10px] font-bold text-purple-300">◈ {value}</p>
    </button>
  )
}

function SceneCard({
  label,
  active,
}: {
  label: string
  active?: boolean
}) {
  return (
    <button
      className={cn(
        'min-h-[64px] rounded-xl border bg-black/25 p-2 text-[10px] font-black transition',
        active
          ? 'border-cyan-300/50 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
          : 'border-white/10 text-slate-400 hover:text-white',
      )}
    >
      <div className="mb-2 h-7 rounded-lg bg-gradient-to-br from-cyan-400/20 to-purple-500/20" />
      {label}
    </button>
  )
}

function StatusMetric({
  label,
  value,
  good,
}: {
  label: string
  value: string
  good?: boolean
}) {
  return (
    <div>
      <p className={cn('text-xs font-black', good ? 'text-emerald-300' : 'text-white')}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500">{label}</p>
    </div>
  )
}

function ObsInstructions() {
  return (
    <Panel>
      <PanelHeader
        icon={<AlertTriangle className="h-4 w-4" />}
        title="OBS Setup Steps"
        right={
          <a
            href="https://obsproject.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-black text-cyan-300"
          >
            OBS
            <ExternalLink className="h-3 w-3" />
          </a>
        }
      />

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <StepCard number="1" title="Open OBS Studio" text="Install OBS Studio on your computer." />
        <StepCard number="2" title="Settings → Stream" text="Set Service to Custom." />
        <StepCard number="3" title="Paste Server URL" text="Copy Troll City's server URL into OBS." />
        <StepCard number="4" title="Paste Stream Key" text="Copy your private stream key into OBS." />
        <StepCard number="5" title="Add Game Capture" text="Use Game Capture, Display Capture, webcam, and alerts." />
        <StepCard number="6" title="Start Streaming" text="Troll City detects the signal and prepares the live feed." />
      </div>
    </Panel>
  )
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-200 ring-1 ring-cyan-300/20">
          {number}
        </div>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
        </div>
      </div>
    </div>
  )
}

function GamingLivePlayer({ streamKey }: { streamKey: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const agoraUrl = React.useMemo(() => {
    if (!streamKey || !RTLS_PLAYER_URL) return null
    return `${RTLS_PLAYER_URL}/${streamKey}`
  }, [streamKey])

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-red-900/30 to-slate-900">
        <div className="text-center p-6">
          <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-3" />
          <p className="text-white font-medium">{error}</p>
          <p className="text-slate-400 text-sm mt-2">Make sure OBS is streaming with the correct stream key.</p>
        </div>
      </div>
    )
  }

  if (!agoraUrl) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-cyan-900/30 to-slate-900">
        <div className="text-center p-6">
          <Loader2 className="h-10 w-10 text-cyan-300 mx-auto mb-3 animate-spin" />
          <p className="text-white font-medium">Loading stream player...</p>
          <p className="text-slate-400 text-sm mt-2">Stream key: {streamKey?.slice(0, 12)}...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      <iframe
        src={agoraUrl}
        className="h-full w-full border-none"
        allow="camera; microphone; fullscreen"
        onLoad={() => setLoading(false)}
        onError={() => setError('Failed to load stream player')}
      />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
      </div>
    </div>
  )
}

function GameSearch({
  query,
  onQueryChange,
  onSelect,
  games,
}: {
  query: string
  onQueryChange: (query: string) => void
  onSelect: (game: string) => void
  games: string[]
}) {
  return (
    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#07111d] shadow-2xl z-50 max-h-60 overflow-y-auto">
      <div className="p-2 border-b border-white/10">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search games..."
          className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
        />
      </div>
      <div className="p-2">
        {games.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-2">No games found</p>
        ) : (
          games.map((game) => (
            <button
              key={game}
              type="button"
              onClick={() => onSelect(game)}
              className="w-full rounded-lg px-3 py-2 text-sm text-left text-white hover:bg-white/10 transition-colors"
            >
              {game}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default GamingSetup