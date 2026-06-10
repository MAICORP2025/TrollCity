import { useState } from 'react'
import type { Tip } from '../types/database'
import { supabase } from '../lib/supabase'

interface TipFormProps {
  creatorId: string
  onSuccess?: (tip: Tip) => void
}

export default function TipForm({ creatorId, onSuccess }: TipFormProps) {
  const [amount, setAmount] = useState(100)
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase
      .from('tips')
      .insert({
        creator_id: creatorId,
        amount_cents: amount,
        message,
        is_anonymous: isAnonymous
      })
      .select()
      .single()
    
    if (!error && data && onSuccess) {
      onSuccess(data)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-6">
      <h3 className="text-xl font-bold mb-4">Send a Tip</h3>
      
      <div className="mb-4">
        <label className="block mb-2">Amount (cents)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full bg-gray-800 rounded-lg px-3 py-2"
          min="1"
          required
        />
      </div>
      
      <div className="mb-4">
        <label className="block mb-2">Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-gray-800 rounded-lg px-3 py-2"
          rows={3}
        />
      </div>
      
      <div className="mb-4 flex items-center">
        <input
          type="checkbox"
          id="anonymous"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="anonymous">Send anonymously</label>
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Tip'}
      </button>
    </form>
  )
}