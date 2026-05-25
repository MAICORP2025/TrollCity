jest.mock('../supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
  ensureSupabaseSession: jest.fn(),
}))

import { awardWatchHypeReward } from '../hypeRewards'
import { supabase, ensureSupabaseSession } from '../supabase'

const mockRpc = supabase.rpc as jest.Mock
const mockEnsureSession = ensureSupabaseSession as jest.Mock

describe('awardWatchHypeReward', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the Supabase RPC path and returns the reward payload', async () => {
    const payload = {
      success: true,
      hype_coins: 42,
      earned_amount: 5,
      daily_earned: 5,
      daily_cap: 25,
      weekly_earned: 5,
      weekly_cap: 175,
      message: 'Awarded',
    }

    mockEnsureSession.mockResolvedValue(undefined)
    mockRpc.mockResolvedValue({ data: payload, error: null })

    await expect(awardWatchHypeReward('stream-123')).resolves.toEqual(payload)

    expect(mockEnsureSession).toHaveBeenCalledWith(supabase)
    expect(mockRpc).toHaveBeenCalledWith('earn_hype_coin_watch_reward', {
      p_stream_id: 'stream-123',
    })
  })

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('rpc failed')

    mockEnsureSession.mockResolvedValue(undefined)
    mockRpc.mockResolvedValue({ data: null, error: rpcError })

    await expect(awardWatchHypeReward('stream-123')).rejects.toThrow('rpc failed')
  })

  it('throws when the RPC returns no payload', async () => {
    mockEnsureSession.mockResolvedValue(undefined)
    mockRpc.mockResolvedValue({ data: null, error: null })

    await expect(awardWatchHypeReward('stream-123')).rejects.toThrow(
      'No response from earn_hype_coin_watch_reward'
    )
  })
})
