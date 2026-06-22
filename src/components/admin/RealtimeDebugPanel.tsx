import { useState, useEffect } from 'react'
import { getStats, getPollingRegistry, getChannelHealth } from '../../lib/realtime/RealtimeManager'
import { getStreamRealtimeDebugState } from '../../lib/realtime/streamRealtimeManager'

export default function RealtimeDebugPanel() {
  const [stats, setStats] = useState(getStats())
  const [polling, setPolling] = useState(getPollingRegistry())
  const [streamRealtime, setStreamRealtime] = useState(getStreamRealtimeDebugState())

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getStats())
      setPolling(getPollingRegistry())
      setStreamRealtime(getStreamRealtimeDebugState())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const health = getChannelHealth(stats.active)

  const healthColor = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  }[health]

  const healthBg = {
    green: 'bg-green-900/30 border-green-700',
    yellow: 'bg-yellow-900/30 border-yellow-700',
    red: 'bg-red-900/30 border-red-700',
  }[health]

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm text-xs font-mono">
      <div className={`rounded-lg border p-3 shadow-xl backdrop-blur-sm ${healthBg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-white">⚡ Realtime Monitor</span>
          <span className={`font-bold ${healthColor}`}>{health.toUpperCase()}</span>
        </div>

        <div className="space-y-1 text-gray-300">
          <div className="flex justify-between">
            <span>Active Channels:</span>
            <span className={healthColor}>{stats.active}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Created:</span>
            <span>{stats.created}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Removed:</span>
            <span>{stats.removed}</span>
          </div>
          <div className="flex justify-between">
            <span>Leaked:</span>
            <span className={stats.leaked > 0 ? 'text-red-400' : ''}>{stats.leaked}</span>
          </div>
          <div className="flex justify-between">
            <span>Polling Loops:</span>
            <span>{polling.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Stream Realtime:</span>
            <span>{streamRealtime.length}</span>
          </div>
        </div>

        {stats.channels.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="text-gray-400 mb-1">Channels:</div>
            {stats.channels.map((ch) => (
              <div key={ch.name} className="flex justify-between text-gray-400">
                <span className="truncate max-w-[180px]" title={ch.name}>{ch.name}</span>
                <span className="ml-2 shrink-0">
                  refs:{ch.refCount} {ch.subscribers > 0 ? `sub:${ch.subscribers}` : ''} {ch.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {polling.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="text-gray-400 mb-1">Polling:</div>
            {polling.map((p) => (
              <div key={p.id} className="flex justify-between text-gray-400">
                <span className="truncate max-w-[140px]" title={p.label}>{p.label}</span>
                <span className="ml-2 shrink-0">{p.intervalMs / 1000}s {p.visibilityOnly ? '👁' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
