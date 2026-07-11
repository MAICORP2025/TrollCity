import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface UserPromoCard {
  id: string
  code: string
  token_amount: number
  source_type: string
  issued_at: string
  expires_at: string | null
  redeemed_at: string | null
  status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function useUserPromoCards() {
  const [cards, setCards] = useState<UserPromoCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const fetchCards = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_promo_cards')
        if (error) throw error
        if (isMounted) setCards((data || []) as UserPromoCard[])
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to load promo cards')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchCards()

    return () => {
      isMounted = false
    }
  }, [])

  return { cards, loading, error }
}
