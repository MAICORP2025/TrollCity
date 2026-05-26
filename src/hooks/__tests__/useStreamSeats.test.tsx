import { act, renderHook } from '@testing-library/react'

const rpcMock = jest.fn()
const toastErrorMock = jest.fn()
const toastSuccessMock = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}))

const subscribeMock = jest.fn().mockImplementation((callback: ((status: string) => void) | undefined) => {
  if (typeof callback === 'function') {
    callback('SUBSCRIBED')
  }
  return { unsubscribe: jest.fn() }
})

const channelMock = {
  on: jest.fn().mockReturnValue({
    subscribe: subscribeMock,
  }),
  subscribe: subscribeMock,
}

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: jest.fn(),
    channel: jest.fn(() => channelMock),
    removeChannel: jest.fn(),
  },
}))

jest.mock('../../lib/store', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      email: 'viewer@example.com',
      username: 'viewer',
    },
  }),
}))

import { useStreamSeats } from '../useStreamSeats'

describe('useStreamSeats', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    rpcMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    jest.spyOn(window, 'setInterval').mockImplementation(() => 0 as unknown as number)
    jest.spyOn(window, 'clearInterval').mockImplementation(() => undefined)

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        return Promise.resolve({ data: [], error: null })
      }

      if (fnName === 'join_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      if (fnName === 'leave_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('clears the seat after leaving immediately after joining', async () => {
    const getSeatsSequence = [
      [],
      [
        {
          id: 'seat-real-1',
          seat_index: 1,
          user_id: 'user-1',
          guest_id: null,
          status: 'reserved',
          joined_at: new Date().toISOString(),
          left_at: null,
          livekit_participant_identity: null,
          seat_price_paid: 10,
          updated_at: new Date().toISOString(),
        },
      ],
      [],
    ]

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        const next = getSeatsSequence.shift()
        return Promise.resolve({ data: next ?? [], error: null })
      }

      if (fnName === 'join_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      if (fnName === 'leave_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHook(() => useStreamSeats('stream-1', 'user-1'))

    await act(async () => {
      await Promise.resolve()
    })

    const joinPromise = act(async () => {
      return result.current.joinSeat(1, 10)
    })

    await act(async () => {
      result.current.leaveSeat()
      await Promise.resolve()
    })

    await act(async () => {
      await joinPromise
      await Promise.resolve()
    })

    await act(async () => {
      await Promise.resolve()
      jest.runOnlyPendingTimers()
    })

    expect(result.current.seats).toEqual({})
    expect(result.current.mySeat).toBeNull()
    expect(rpcMock).toHaveBeenCalledWith('leave_seat_atomic', { p_session_id: 'seat-real-1' })
  })
})
