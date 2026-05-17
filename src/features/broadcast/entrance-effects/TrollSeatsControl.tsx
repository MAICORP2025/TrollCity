import React, { useState } from 'react'
import type { TrollSeat } from './trollSeatsTypes'

interface TrollSeatsControlProps {
  trollSeats: TrollSeat[]
  message?: string | null
  onAddTrollSeat: (seatPrice?: number) => Promise<unknown>
  onDeductTrollSeat: () => Promise<unknown>
  onApproveCohost?: (trollSeatId: string) => Promise<unknown>
  allowSeatPrice?: boolean
}

export function TrollSeatsControl({
  trollSeats,
  message,
  onAddTrollSeat,
  onDeductTrollSeat,
  onApproveCohost,
  allowSeatPrice = true,
}: TrollSeatsControlProps) {
  const [open, setOpen] = useState(false)
  const [seatPrice, setSeatPrice] = useState(0)
  const [busy, setBusy] = useState(false)

  const activeSeats = trollSeats.filter((seat) => seat.status !== 'removed')
  const pendingApprovalSeats = activeSeats.filter(
    (seat) => seat.status === 'paid_pending_approval' && seat.user_id
  )

  const addDisabled = activeSeats.length >= 6 || busy
  const deductDisabled = busy || !activeSeats.some(
    (seat) => seat.status === 'empty' && !seat.user_id
  )

  const handleAdd = async () => {
    setBusy(true)
    try {
      await onAddTrollSeat(seatPrice)
    } finally {
      setBusy(false)
    }
  }

  const handleDeduct = async () => {
    setBusy(true)
    try {
      await onDeductTrollSeat()
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async (id: string) => {
    if (!onApproveCohost) return

    setBusy(true)
    try {
      await onApproveCohost(id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative inline-flex overflow-visible">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-cyan-300/50 bg-slate-950/80 px-3 py-2 text-xs font-bold text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.25)] hover:bg-cyan-950/70"
      >
        TrollSeats
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[9999] mt-2 min-w-[18rem] rounded-xl border border-cyan-300/40 bg-slate-950/95 p-3 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.35)] backdrop-blur-md pointer-events-auto">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold">TrollSeats</div>
            <div className="text-xs text-cyan-200/80">
              {activeSeats.length}/6
            </div>
          </div>

          {allowSeatPrice ? (
            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] text-cyan-200/75">
                TrollSeat price
              </span>
              <input
                type="number"
                min={0}
                value={seatPrice}
                onChange={(event) => setSeatPrice(Math.max(0, Number(event.target.value || 0)))}
                className="w-full rounded-lg border border-cyan-300/30 bg-slate-900 px-2 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-300"
              />
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={addDisabled}
              onClick={handleAdd}
              className="rounded-lg border border-cyan-300/40 bg-cyan-950/50 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add 1 TrollSeat
            </button>

            <button
              type="button"
              disabled={deductDisabled}
              onClick={handleDeduct}
              className="rounded-lg border border-pink-300/40 bg-pink-950/40 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Deduct 1 TrollSeat
            </button>
          </div>

          {pendingApprovalSeats.length ? (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">
                Pending Approval
              </div>

              {pendingApprovalSeats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleApprove(seat.id)}
                  className="w-full rounded-lg border border-yellow-300/40 bg-yellow-950/30 px-3 py-2 text-left text-xs font-semibold text-yellow-100 disabled:opacity-40"
                >
                  Approve TrollSeat {seat.seat_index + 1}
                </button>
              ))}
            </div>
          ) : null}

          {message ? (
            <div className="mt-3 rounded-lg border border-cyan-300/20 bg-slate-900/80 px-2 py-2 text-xs text-cyan-100">
              {message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}