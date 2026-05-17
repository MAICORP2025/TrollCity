import React from 'react'
import type { TrollSeatsOverlayProps } from './trollSeatsTypes'
import { TrollSeatPod } from './TrollSeatPod'
import {
  getTrollSeatPositionClass,
  sortTrollSeats,
} from './trollSeatsUtils'

export function TrollSeatsOverlay({
  trollSeats,
  profilesByUserId = {},
  tracksByUserId = {},
  goldenRingByUserId = {},
  onOpenUserStats,
  onRequestSeat,
  className = '',
}: TrollSeatsOverlayProps) {
  const seats = sortTrollSeats(trollSeats)

  if (!seats.length) return null

  return (
    <div
      className={[
        'pointer-events-none absolute inset-0 z-30',
        className,
      ].join(' ')}
    >
      {seats.map((seat) => {
        const userId = seat.user_id || ''
        const profile = userId ? profilesByUserId[userId] : undefined
        const tracks = userId ? tracksByUserId[userId] : undefined
        const hasGoldenRing = userId ? !!goldenRingByUserId[userId] : false

        return (
          <div
            key={seat.id}
            className={[
              'pointer-events-auto absolute',
              getTrollSeatPositionClass(seat.seat_index),
            ].join(' ')}
          >
            <TrollSeatPod
              seat={seat}
              profile={profile}
              tracks={tracks}
              hasGoldenRing={hasGoldenRing}
              onOpenUserStats={onOpenUserStats}
            />
          </div>
        )
      })}

      {onRequestSeat ? (
        <button
          type="button"
          onClick={onRequestSeat}
          className={[
            'pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2',
            'rounded-full border border-cyan-300/60 bg-slate-950/85',
            'px-4 py-2 text-xs font-bold text-cyan-100',
            'shadow-[0_0_20px_rgba(34,211,238,0.35)]',
            'hover:bg-cyan-950/80',
          ].join(' ')}
        >
          Request TrollSeat
        </button>
      ) : null}
    </div>
  )
}