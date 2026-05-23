import { renderHook, act } from '@testing-library/react'

const rpcMock = jest.fn()
const toastSuccessMock = jest.fn()
const toastErrorMock = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: jest.fn(),
  },
}))

import { useRandomBattleQueueController } from '../useRandomBattleQueueController'

describe('useRandomBattleQueueController', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    rpcMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    rpcMock.mockResolvedValue({ data: { success: true }, error: null })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('activates a stale random battle when the host is already in a ready state', async () => {
    const onStreamUpdate = jest.fn()

    const stream = {
      id: 'stream-1',
      user_id: 'user-1',
      category: 'general',
      status: 'live',
      is_battle: false,
      battle_id: 'battle-1',
      battle_mode: 'random_queue',
      battle_status: 'ready',
      battle_start_time: new Date(Date.now() - 1000).toISOString(),
      battle_end_time: new Date(Date.now() + 60_000).toISOString(),
      random_battle_queue_enabled: false,
      random_battle_queued_at: null,
      random_battle_cooldown_until: null,
    } as any

    renderHook(() =>
      useRandomBattleQueueController({
        stream,
        userId: 'user-1',
        isBroadcaster: true,
        onStreamUpdate,
      }),
    )

    await act(async () => {
      jest.runOnlyPendingTimers()
      await Promise.resolve()
    })

    expect(rpcMock).toHaveBeenCalledWith('activate_random_battle', { p_battle_id: 'battle-1' })
    expect(onStreamUpdate).toHaveBeenCalledWith({ battle_status: 'active' })
  })
})
