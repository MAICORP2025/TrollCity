// Lightweight stub for seat LiveKit hook
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

export function useSeatLiveKit(_options: any) {
  const status = {
    state: 'idle' as SeatLiveKitState,
    isConnected: false,
    hasPublishedTracks: false,
    error: null as string | null,
    audioTrack: null as any,
    videoTrack: null as any,
  }

  const disconnect = async () => {
    return
  }

  return { status, disconnect }
}
