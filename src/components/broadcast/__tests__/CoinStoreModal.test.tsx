import React from 'react'
import { render, waitFor } from '@testing-library/react'
import CoinStoreModal from '../CoinStoreModal'
import { toast } from 'sonner'

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/lib/store', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('../PayPalPaymentModal', () => () => <div data-testid="paypal-modal" />)

const { useAuthStore } = jest.requireMock('@/lib/store') as { useAuthStore: jest.Mock }

describe('CoinStoreModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.mockReturnValue({
      user: null,
      profile: null,
    })
  })

  it('closes itself and warns when an anonymous user tries to open the coin store', async () => {
    const onClose = jest.fn()

    render(<CoinStoreModal isOpen onClose={onClose} />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sign in to use the coin store.')
      expect(onClose).toHaveBeenCalled()
    })
  })
})
