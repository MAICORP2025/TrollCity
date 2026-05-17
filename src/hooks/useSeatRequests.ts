// Minimal stub for useSeatRequests
export function useSeatRequests(_streamId?: string) {
  const requests: any[] = []
  const currentRequest = null
  const hasPendingOrApproved = false
  const loading = false
  const error: string | null = null

  const requestSeat = async (_seatIndex: number, _seatPrice = 0) => ({ success: false, error: 'disabled' })
  const cancelRequest = async (_requestId: string) => ({ success: false })
  const refetch = async () => {}

  return {
    requests,
    currentRequest,
    hasPendingOrApproved,
    loading,
    error,
    requestSeat,
    cancelRequest,
    refetch,
  }
}
