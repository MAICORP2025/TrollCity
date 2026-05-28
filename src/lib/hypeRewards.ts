import { supabase, ensureSupabaseSession } from './supabase'

export interface HypeCoinWatchResponse {
  success: boolean
  hype_coins: number
  earned_amount: number
  daily_earned: number
  daily_cap: number
  weekly_earned: number
  weekly_cap: number
  message: string
}

export async function awardWatchHypeReward(
  streamId: string
): Promise<HypeCoinWatchResponse> {
  if (!streamId) {
    throw new Error('No stream ID provided')
  }

  await ensureSupabaseSession(supabase)

  const { data, error } = await supabase.rpc('earn_hype_coin_watch_reward', {
    p_stream_id: streamId,
  })

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('No response from earn_hype_coin_watch_reward')
  }

  // Supabase returns TABLE results as an array
  const response = Array.isArray(data) ? data[0] : data
  return response as HypeCoinWatchResponse
}
