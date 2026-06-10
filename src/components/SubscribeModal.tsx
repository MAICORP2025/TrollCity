import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { CreatorProfile } from '../types/database'
import { supabase } from '../lib/supabase'

interface SubscribeModalProps {
  creator: CreatorProfile
  onClose: () => void
  onSubscribe: () => void
}

export default function SubscribeModal({ creator, onClose, onSubscribe }: SubscribeModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    if (!user) return
    
    setLoading(true)
    const { error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
    
    if (!error) {
      onSubscribe()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Subscribe to Creator</h2>
        <p className="text-gray-400 mb-6">Get exclusive access to chats and premium content</p>
        
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full"></div>
            <div>
              <p className="font-semibold">Premium Subscription</p>
              <p className="text-gray-400 text-sm">$4.99/month</p>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubscribe}
            disabled={loading || !user}
            className="flex-1 bg-purple-600 hover:bg-purple-500 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Subscribe'}
          </button>
        </div>
      </div>
    </div>
  )
}