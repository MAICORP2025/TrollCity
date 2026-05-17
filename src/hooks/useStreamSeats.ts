export interface SeatSession {
  id: string
  seat_index: number
  user_id?: string
  guest_id?: string
  user_profile?: any
  status?: 'active' | 'reserved' | 'left' | 'kicked'
  joined_at?: string
}

export function useStreamSeats(
  _streamId?: string,
  _userId?: string,
  _broadcasterProfile?: any,
  _streamData?: any,
) {
  // Minimal stub implementation to preserve the hook API while
  // the old queue/session logic is removed. Replace with
  // TrollSeats implementation in following steps.

  const seats: Record<number, SeatSession> = {}
  const mySession: SeatSession | null = null
  const seatJoinTransition: any = null

  const joinSeat = async (index: number, _price?: number) => {
    // Return false by default (no-op)
    return false
  }

  const leaveSeat = async () => {
    return
  }

  const handleParticipantDisconnected = (_identity: string) => {}

  const pendingSeatRequests: any[] = []
  const loadingSeatRequests = false

  const approveSeatRequest = async (_id: string) => null
  const denySeatRequest = async (_id: string, _reason?: string) => false
  const refreshSeatRequests = () => {}

  const capacity = {
    capacity: 0,
    isInQueue: false,
    canJoinInteractively: false,
    joinQueue: async () => false,
    leaveQueue: async () => false,
  }

  const myRequest = null

  return {
    seats,
    mySession,
    seatJoinTransition,
    joinSeat,
    leaveSeat,
    handleParticipantDisconnected,
    pendingSeatRequests,
    loadingSeatRequests,
    approveSeatRequest,
    denySeatRequest,
    refreshSeatRequests,
    capacity,
    isInQueue: false,
    canJoinInteractively: false,
    joinQueue: capacity.joinQueue,
    leaveQueue: capacity.leaveQueue,
    myRequest,
  }
}
