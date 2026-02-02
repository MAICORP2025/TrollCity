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

    // Subscribe to Broadcast channel (Primary source - Fast, No DB load)
    const _broadcastChannel = supabase
      .channel(`stream_events_${streamId}`)
      .on('broadcast', { event: 'gift_sent' }, (payload) => {
        console.log('📡 Broadcast gift received:', payload.payload)
        handleGiftPayload(payload.payload, 'broadcast')
      })
      .subscribe()

    // Subscribe to both possible gift tables for compatibility (Backup source)
    // NOTE: We do NOT fetch user profiles here to prevent DB DDoS
    const streamGiftsChannel = supabase
      .channel(`stream_gifts_events_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_gifts', filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          console.log('🎁 New stream_gift received (DB):', payload.new)
          // We rely on broadcast for rich data. DB events are just for logging/backup.
          // We intentionally do NOT fetch sender profile to avoid N+1 query storm.
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
          console.log('🎁 New gift received (DB):', payload.new)
          await handleGiftPayload(payload.new, 'gifts')
        }
      )
      .subscribe((status) => {
        console.log('📡 Gifts subscription status:', status)
      })

    const handleGiftPayload = async (gift: any, sourceType: string) => {
      try {
        // If it's a broadcast, we have full data.
        // If it's DB, we use what we have and DO NOT fetch profile to save DB.
        
        const senderUsername = gift.sender_username || 'Anonymous'
        const senderAvatar = gift.sender_avatar || null
        const senderRole = gift.sender_role || null
        const senderTrollRole = gift.sender_troll_role || null
        
        const senderId = gift.from_user_id || gift.sender_id || gift.senderId

        // ONLY fetch if strictly necessary and not from broadcast (and maybe limit this?)
        // actually, we will DISABLE fetching entirely for DB events to guarantee scalability.
        // If the client wants to see the name, they rely on the Broadcast event.
        
        /* 
        // DISABLED TO PREVENT DDOS
        if (senderId && sourceType !== 'broadcast' && !gift.sender_username) {
             // ... fetching logic removed ...
        }
        */
        
        const amount = sourceType === 'broadcast' 
          ? Number(gift.amount || 0)
          : Number((gift.coins_amount ?? gift.coins_spent ?? 0))

        const tier = getTier(amount)

        const transformedGift = {
          id: gift.id || gift.gift_id || 'unknown',
          coinCost: amount,
          name: gift.gift_name || gift.message || gift.gift_type || 'Gift',
          sender_username: senderUsername,
          sender_id: senderId,
          sender_avatar: senderAvatar,
          sender_role: senderRole,
          sender_troll_role: senderTrollRole,
          quantity: gift.quantity || 1,
          icon: getGiftIcon(gift.gift_name || gift.message || gift.gift_type || 'Gift'),
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
          
          // Only show combo if >= 2
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
