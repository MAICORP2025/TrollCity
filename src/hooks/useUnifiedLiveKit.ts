import { useEffect, useMemo } from 'react'
import { useLiveKit } from '../contexts/LiveKitContext'

export interface UnifiedLiveKitConfig {
  roomName: string
  user: any
  autoPublish?: boolean
  maxReconnectAttempts?: number
}

// Thin wrapper around the global LiveKit service that connects/disconnects at page level
export function useUnifiedLiveKit(config: UnifiedLiveKitConfig) {
  const {
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    getRoom,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    service,
  } = useLiveKit()

  // Connect on mount with provided config; disconnect when page unmounts
  useEffect(() => {
    if (!config.roomName || !config.user) return

    connect(config.roomName, config.user, {
      autoPublish: config.autoPublish !== false,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
    })

    return () => {
      disconnect()
    }
  }, [
    connect,
    disconnect,
    config.roomName,
    config.user?.id,
    config.autoPublish,
    config.maxReconnectAttempts,
  ])

  // Stable connect helper that reuses the current config by default
  const connectWithConfig = useMemo(
    () => () =>
      connect(config.roomName, config.user, {
        autoPublish: config.autoPublish !== false,
        maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      }),
    [connect, config.roomName, config.user, config.autoPublish, config.maxReconnectAttempts]
  )

  return {
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    connect: connectWithConfig,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    getRoom,
    service,
  }
}
