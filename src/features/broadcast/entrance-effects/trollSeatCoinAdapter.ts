import { supabase } from '../../../lib/supabase'

interface ChargeSeatInput {
  streamId: string
  userId: string
  broadcasterId: string
  amount: number
  trollSeatId: string
}

interface RefundSeatInput {
  streamId: string
  userId: string
  broadcasterId: string
  amount: number
  trollSeatId: string
}

/**
 * IMPORTANT:
 * This file intentionally routes coin movement through existing app patterns.
 * Replace the RPC names below only if your current project uses different names.
 *
 * Do NOT create a second coin system.
 */
export async function chargeTrollSeatPrice(input: ChargeSeatInput): Promise<void> {
  if (!input.amount || input.amount <= 0) return

  const { error } = await supabase.rpc('spend_troll_coins', {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: 'trollseat_entry',
    p_stream_id: input.streamId,
    p_metadata: {
      trollseat_id: input.trollSeatId,
      broadcaster_id: input.broadcasterId,
    },
  })

  if (error) {
    throw new Error(error.message || 'Unable to charge TrollSeat price')
  }
}

export async function refundTrollSeatHalf(input: RefundSeatInput): Promise<void> {
  if (!input.amount || input.amount <= 0) return

  const { error } = await supabase.rpc('grant_troll_coins', {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: 'trollseat_half_refund',
    p_stream_id: input.streamId,
    p_metadata: {
      trollseat_id: input.trollSeatId,
      broadcaster_id: input.broadcasterId,
    },
  })

  if (error) {
    throw new Error(error.message || 'Unable to refund TrollSeat coins')
  }
}