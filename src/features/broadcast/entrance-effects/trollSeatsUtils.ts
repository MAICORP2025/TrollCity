import type {
  TrollSeat,
  TrollSeatCoinReceivedMap,
  TrollSeatGoldenRingMap,
  TrollSeatUserProfile,
} from './trollSeatsTypes'

export const MAX_TROLL_SEATS = 6
export const GOLDEN_RING_THRESHOLD = 1000

export function sortTrollSeats(seats: TrollSeat[]): TrollSeat[] {
  return [...seats]
    .filter((seat) => seat.status !== 'removed')
    .sort((a, b) => a.seat_index - b.seat_index)
}

export function getTrollSeatPositionClass(index: number): string {
  switch (index) {
    case 0:
      return 'left-3 top-4'
    case 1:
      return 'left-3 top-1/2 -translate-y-1/2'
    case 2:
      return 'left-3 bottom-4'
    case 3:
      return 'right-3 top-4'
    case 4:
      return 'right-3 top-1/2 -translate-y-1/2'
    case 5:
      return 'right-3 bottom-4'
    default:
      return 'hidden'
  }
}

export function getTrollSeatName(profile?: TrollSeatUserProfile | null): string {
  if (!profile) return 'Cohost'
  return (
    profile.display_name ||
    profile.username ||
    'Cohost'
  )
}

export function getTrollSeatAvatar(profile?: TrollSeatUserProfile | null): string | null {
  if (!profile) return null
  return (
    profile.avatar_url ||
    profile.profile_image_url ||
    profile.photo_url ||
    null
  )
}

export function buildGoldenRingMap(
  receivedByUserId: TrollSeatCoinReceivedMap
): TrollSeatGoldenRingMap {
  return Object.fromEntries(
    Object.entries(receivedByUserId).map(([userId, total]) => [
      userId,
      Number(total || 0) > GOLDEN_RING_THRESHOLD,
    ])
  )
}

export function canDeductOneTrollSeat(seats: TrollSeat[]): boolean {
  return sortTrollSeats(seats).some(
    (seat) => seat.status === 'empty' && !seat.user_id
  )
}

export function getNewestEmptyTrollSeat(seats: TrollSeat[]): TrollSeat | null {
  const emptySeats = sortTrollSeats(seats).filter(
    (seat) => seat.status === 'empty' && !seat.user_id
  )

  if (!emptySeats.length) return null

  return emptySeats.sort((a, b) => b.seat_index - a.seat_index)[0]
}