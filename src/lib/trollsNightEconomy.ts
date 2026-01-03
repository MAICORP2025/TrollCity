import { supabase } from './supabase'

/**
 * Validates and processes a Trolls@Night Entry Pass payment.
 * 
 * Logic:
 * 1. Checks if user has enough coins (300).
 * 2. Deducts 300 coins from user.
 * 3. Splits coins: 225 to Broadcaster, 75 to Admin Bank.
 * 4. Logs the transaction.
 */
export async function payEntryPass(userId: string, broadcasterId: string, streamId: string) {
  // Use RPC for atomic transaction to prevent race conditions
  const { data, error } = await supabase.rpc('pay_trolls_night_entry', {
    p_user_id: userId,
    p_broadcaster_id: broadcasterId,
    p_stream_id: streamId,
    p_amount: 300,
    p_split_broadcaster: 225,
    p_split_bank: 75
  })

  if (error) {
    console.error('Entry Pass Payment Failed:', error)
    return { success: false, error: error.message }
  }

  return { success: true, transactionId: data }
}

/**
 * Sends a custom tip from a viewer to a broadcaster.
 * 
 * Logic:
 * 1. Validates amount (must be > 0).
 * 2. Deducts amount from user.
 * 3. Adds amount to broadcaster (100% or platform fee applied if needed).
 * 4. Logs transaction.
 */
export async function sendCustomTip(userId: string, broadcasterId: string, amount: number, message?: string) {
  if (amount <= 0) return { success: false, error: 'Invalid amount' }

  // Use RPC for atomic transaction
  const { data, error } = await supabase.rpc('send_trolls_night_tip', {
    p_sender_id: userId,
    p_recipient_id: broadcasterId,
    p_amount: amount,
    p_message: message || ''
  })

  if (error) {
    console.error('Tip Failed:', error)
    return { success: false, error: error.message }
  }

  return { success: true, transactionId: data }
}

/**
 * Checks if a user has an active Entry Pass for a specific broadcaster/stream.
 */
export async function checkEntryPass(userId: string, broadcasterId: string) {
  // In a real implementation, we would check a `stream_access` table.
  // For now, we simulate this check or check if a transaction occurred recently.
  
  const { data, error } = await supabase
    .from('coin_transactions')
    .select('id')
    .eq('sender_id', userId)
    .eq('recipient_id', broadcasterId)
    .eq('type', 'entry_pass')
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Valid for 24h
    .limit(1)

  if (error) {
    console.error('Entry Pass Check Error:', error)
    return false
  }

  return data && data.length > 0
}
