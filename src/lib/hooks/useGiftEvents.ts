import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export function useGiftEvents(streamId?: string | null) {
  const [lastGift, setLastGift] = useState<any>(null)
  const comboMapRef = useRef<Record<string, { count: number; lastTime: number }>>({})
  // Force re-render on combo update if needed, but for now just using Ref for logic
  const [, _setTick] = useState(0) 

  useEffect(() => {
    if (!streamId) return

    console.log('🎁 Setting up gift events subscription for stream:', streamId)

    // Subscribe to both possible gift tables for compatibility
    const streamGiftsChannel = supabase
      .channel(`stream_gifts_events_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_gifts', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          console.log('🎁 New stream_gift received:', payload.new)
          await handleGiftPayload(payload.new, 'stream_gifts')
        }
      )
      .subscribe((status) => {
        console.log('📡 Stream gifts subscription status:', status)
      })

    const giftsChannel = supabase
      .channel(`gifts_events_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gifts', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          console.log('🎁 New gift received:', payload.new)
          await handleGiftPayload(payload.new, 'gifts')
        }
      )
      .subscribe((status) => {
        console.log('📡 Gifts subscription status:', status)
      })

    const handleGiftPayload = async (gift: any, tableType: string) => {
      try {
        // Fetch sender username for display
        let senderUsername = 'Anonymous'
        let senderAvatar = null
        let senderRole: string | null = null
        let senderTrollRole: string | null = null
        const senderId = gift.from_user_id || gift.sender_id
        
        if (senderId) {
          try {
            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select('username, avatar_url, role, troll_role')
              .eq('id', senderId)
              .single()
              
            if (senderProfile?.username) {
              senderUsername = senderProfile.username
              senderAvatar = senderProfile.avatar_url
              senderRole = senderProfile.role || null
              senderTrollRole = senderProfile.troll_role || null
            }
          } catch (e) {
            console.warn('Failed to fetch sender username:', e)
          }
        }
        
        const amount = tableType === 'stream_gifts'
          ? Number((gift.coins_amount ?? gift.coins_spent ?? 0))
          : Number((gift.coins_spent ?? gift.coins_amount ?? 0))

        const tier = getTier(amount)

        const transformedGift = {
          id: gift.gift_id || gift.id || 'unknown',
          coinCost: amount,
          name: gift.message || gift.gift_type || 'Gift',
          sender_username: senderUsername,
          sender_id: senderId,
          sender_avatar: senderAvatar,
          sender_role: senderRole,
          sender_troll_role: senderTrollRole,
          quantity: gift.quantity || 1,
          icon: getGiftIcon(gift.message || gift.gift_type || 'Gift'),
          tier,
          ...gift
        }

        console.log('🎆 Transformed gift for display:', transformedGift)

        const now = Date.now()
        let comboCount = 0
        
        if (senderId) {
          const prevEntry = comboMapRef.current[senderId] || { count: 0, lastTime: 0 }
          const withinWindow = now - prevEntry.lastTime <= 10000
          
          const newCount = withinWindow ? prevEntry.count + 1 : 1
          comboMapRef.current[senderId] = { count: newCount, lastTime: now }
          
          // Only show combo if >= 2 (or 3 as requested)
          if (newCount >= 2) {
             comboCount = newCount
          }
        }

        transformedGift.comboCount = comboCount
        setLastGift(transformedGift)

        // Auto-clear after 5 seconds
        setTimeout(() => setLastGift(null), 5000)
      } catch (error) {
        console.error('Error handling gift payload:', error)
      }
    }

    const getGiftIcon = (giftType: string): string => {
      const iconMap: Record<string, string> = {
        'Heart': '❤️',
        'Troll Face': '🧌',
        'Gold Coin': '🪙',
        'Crown': '👑',
        'Diamond': '💎',
        'Rocket': '🚀',
        'paid': '🎁',
        'trollmond': '🧌',
      }
      return iconMap[giftType] || '🎁'
    }

    const getTier = (coins: number): 'basic' | 'rare' | 'epic' | 'legendary' | 'millionaire' => {
      if (coins >= 250000) return 'millionaire'
      if (coins >= 20000) return 'legendary'
      if (coins >= 1200) return 'epic'
      if (coins >= 100) return 'rare'
      return 'basic'
    }

    return () => {
      console.log('🧼 Cleaning up gift event subscriptions')
      supabase.removeChannel(streamGiftsChannel)
      supabase.removeChannel(giftsChannel)
    }
  }, [streamId])

  return lastGift
}
