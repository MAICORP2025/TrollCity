import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const PaymentCallback = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing payment...')
  const [coinsAwarded] = useState<number | null>(null)

  useEffect(() => {
    const processPayment = async () => {
      if (!user) {
        toast.error('Please sign in')
        navigate('/auth')
        return
      }

      const params = new URLSearchParams(location.search)
      const canceled = params.get('canceled')
      const success = params.get('success')

      if (canceled) {
        setStatus('error')
        setMessage('Payment was cancelled.')
        toast.info('Payment cancelled')
        return
      }

      if (success) {
        setStatus('success')
        setMessage('Payment successful. Your wallet will update shortly.')
        return
      }

      setStatus('processing')
      setMessage('Waiting for payment confirmation...')
    }

    processPayment()
  }, [location.search, navigate, user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md text-center shadow-xl">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-4">Processing Payment</h1>
            <p className="text-[#E2E2E2]/80 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-4 text-green-400">Payment Successful!</h1>
            <p className="text-[#E2E2E2]/80 mb-4">{message}</p>
            {coinsAwarded && (
              <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400">Coins Added</p>
                <p className="text-3xl font-bold text-purple-400">{coinsAwarded.toLocaleString()}</p>
              </div>
            )}
            <button
              onClick={() => navigate('/store')}
              className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded hover:shadow-lg transition"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-2 mt-3 bg-[#23232b] border border-gray-600 text-white font-semibold rounded hover:bg-[#23232b]/80 transition"
            >
              Go to Profile
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-4 text-red-400">Payment Issue</h1>
            <p className="text-[#E2E2E2]/80 mb-6">{message}</p>
            <button
              onClick={() => navigate('/store')}
              className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded hover:shadow-lg transition"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-2 mt-3 bg-[#23232b] border border-gray-600 text-white font-semibold rounded hover:bg-[#23232b]/80 transition"
            >
              Go to Profile
            </button>
            <p className="text-xs text-gray-500 mt-4">
              If you were charged but didn't receive coins, please contact support with your order ID.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentCallback

