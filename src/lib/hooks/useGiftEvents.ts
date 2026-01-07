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
        const senderId = tableType === 'stream_gifts' ? gift.from_user_id : gift.sender_id
        
        if (senderId) {
          try {
            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', senderId)
              .single()
              
            if (senderProfile?.username) {
              senderUsername = senderProfile.username
              senderAvatar = senderProfile.avatar_url
            }
          } catch (e) {
            console.warn('Failed to fetch sender username:', e)
          }
        }
        
        const amount = tableType === 'stream_gifts' 
          ? Number(gift.coins_amount || 0) 
          : Number(gift.coins_spent || 0)

        const tier = getTier(amount)

        // Transform gift data to match GiftEventOverlay expectations
        const transformedGift = {
          id: gift.gift_id || gift.id || 'unknown',
          coinCost: amount,
          name: gift.message || gift.gift_type || 'Gift',
          sender_username: senderUsername,
          sender_id: senderId,
          sender_avatar: senderAvatar,
          quantity: gift.quantity || 1,
          icon: getGiftIcon(gift.message || gift.gift_type || 'Gift'),
          tier,
          ...gift
        }

        console.log('🎆 Transformed gift for display:', transformedGift)
        playGiftSound(tier)

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

    const playGiftSound = (tier: 'basic' | 'rare' | 'epic' | 'legendary' | 'millionaire') => {
      const mute = localStorage.getItem('tc_mute_gift_sounds') === 'true'
      if (mute) return
      const limitHigh = localStorage.getItem('tc_limit_high_tier_sounds') === 'true'
      const streamSafe = localStorage.getItem('tc_stream_safe_mode') === 'true'

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const gain = ctx.createGain()
      gain.gain.value = streamSafe ? 0.2 : 0.6
      gain.connect(ctx.destination)

      const playTone = (freq: number, durationMs: number, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.value = freq
        osc.connect(gain)
        const now = ctx.currentTime
        osc.start(now)
        osc.stop(now + durationMs / 1000)
      }

      if (tier === 'basic') {
        playTone(800, 150, 'sine')
      } else if (tier === 'rare') {
        playTone(500, 300, 'triangle')
        playTone(900, 200, 'triangle')
      } else if (tier === 'epic') {
        playTone(200, limitHigh ? 600 : 1800, 'sawtooth')
        playTone(400, limitHigh ? 300 : 900, 'square')
      } else if (tier === 'legendary') {
        if (limitHigh) {
          playTone(300, 800, 'sawtooth')
        } else {
          playTone(250, 1500, 'sawtooth')
          playTone(600, 1200, 'square')
        }
      } else {
        if (limitHigh) {
          playTone(280, 1000, 'triangle')
        } else {
          playTone(300, 800, 'square')
          setTimeout(() => playTone(600, 800, 'square'), 900)
          setTimeout(() => playTone(450, 800, 'square'), 1800)
        }
      }
    }

    return () => {
      console.log('🧼 Cleaning up gift event subscriptions')
      supabase.removeChannel(streamGiftsChannel)
      supabase.removeChannel(giftsChannel)
    }
  }, [streamId])

  return lastGift
}
