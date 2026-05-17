// Minimal stub for broadcaster seat queue hook
export function useBroadcasterSeatQueue(_streamId?: string) {
  const requests: any[] = []
  const pendingRequests: any[] = []
  const approvedRequests: any[] = []
  const pendingCount = 0
  const loading = false
  const error: string | null = null

  const approveSeat = async (_requestId: string) => ({ success: false })
  const denySeat = async (_requestId: string, _reason?: string) => ({ success: false })
  const refetch = async () => {}

  return {
    requests,
    pendingRequests,
    approvedRequests,
    pendingCount,
    loading,
    error,
    approveSeat,
    denySeat,
    refetch,
  }
}
