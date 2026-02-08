import { useState } from 'react'
import { supabase } from '../../lib/supabase'
// Removed progressionEngine import - using direct RPC calls instead
import { processGiftXp } from '../xp'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'

import { generateUUID } from '../uuid'
import { coinOptimizer } from '../coinRotation'

export interface GiftItem {
  id: string
  name: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
  category?: string
  subcategory?: string
  slug?: string
  currency?: 'troll_coins'
}

export function useGiftSystem(
  streamerId: string, 
  streamId: string | null, 
  activeBattleId?: string | null,
  receiverId?: string | null // Optional: specific receiver (for participant targeting)
) {
  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)
  
  const toGiftSlug = (value?: string) => {
    if (!value) return 'gift'
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift'
  }

  const sendGift = async (gift: GiftItem, overrideReceiverId?: string): Promise<boolean | { success: boolean; bonus?: any }> => {
    if (!user || !profile) { 
      toast.error('You must be logged in to send gifts.')
      return false 
    }

    // Use receiverId if provided, otherwise fallback to streamerId
    const targetReceiverId = overrideReceiverId || receiverId || streamerId

    // Validate balance based on gift type (paid or free)
    const currency = gift.currency || 'troll_coins'
    
    let balance = 0
    if (gift.type === 'paid') {
      balance = (profile.troll_coins || 0)
    }

    if (balance < gift.coinCost) {
      toast.error(`Not enough Coins for this gift.`)
      return false
    }

    setIsSending(true)
    try {
      console.log('[GiftDebugger] Sending gift...', {
        sender: user.id,
        receiver: targetReceiverId,
        streamId: streamId || null,
        giftId: gift.id,
        cost: gift.coinCost,
        currentBalance: profile.troll_coins
      })

      // ✅ REAL COIN LOGIC: Use send_premium_gift RPC
      // This handles: Balance check, Cost deduction, Cashback (Random + 5%), Receiver Credit (95%), Status (RGB/Gold), Logs
      const { data: result, error: rpcError } = await supabase.rpc('send_premium_gift', {
        p_sender_id: user.id,
        p_receiver_id: targetReceiverId,
        p_stream_id: streamId || null,
        p_gift_id: gift.id,
        p_cost: gift.coinCost,
        p_quantity: 1
      })

      console.log('[GiftDebugger] RPC Result:', { result, rpcError })

      if (rpcError) {
        throw rpcError
      }

      // Check RPC internal logic success
      // Handle boolean result (legacy RPC)
      if (typeof result === 'boolean') {
          if (!result) {
              toast.error('Insufficient funds or error')
              return false
          }
      } 
      // Handle object result
      else if (result && typeof result === 'object' && 'success' in result && !result.success) {
         toast.error(result.message || 'Insufficient funds or error')
         return false
      }

      // Handle Success & Rewards
      if (result.cashback > 0) {
        toast.success(`Cashback! +${result.cashback} Coins Returned!`)
      }
      if (result.rgb_awarded) {
        toast.success('RGB Username Unlocked! (30 Days)')
      }
      if (result.gold_awarded) {
        toast.success('LEGENDARY! GOLD STATUS PERMANENTLY UNLOCKED!')
      }
      
      // Update local profile balance immediately
      if (profile) {
        useAuthStore.getState().setProfile({
          ...profile,
          troll_coins: (profile.troll_coins || 0) - gift.coinCost + (result.cashback || 0),
          is_gold: result.gold_awarded || profile.is_gold,
          rgb_username_expires_at: result.rgb_awarded 
            ? new Date(Date.now() + 30*24*60*60*1000).toISOString() 
            : profile.rgb_username_expires_at
        })
      }

      // Broadcast gift event to the stream channel for immediate display
      if (streamId && streamId !== 'null') {
        // Fire and forget - don't await
        (async () => {
          try {
            const channel = supabase.channel(`stream_events_${streamId}`)
            channel.subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                await channel.send({
                  type: 'broadcast',
                  event: 'gift_sent',
                  payload: {
                    id: generateUUID(),
                    sender_id: user.id,
                    sender_username: profile.username || 'Anonymous',
                    sender_avatar: profile.avatar_url,
                    sender_role: profile.role,
                    sender_troll_role: profile.troll_role,
                    gift_slug: gift.slug || toGiftSlug(gift.name),
                    gift_name: gift.name,
                    amount: gift.coinCost,
                    quantity: 1,
                    timestamp: Date.now(),
                    stream_id: streamId
                  }
                })
                // Short delay to ensure message goes out before cleanup
                setTimeout(() => supabase.removeChannel(channel), 1000)
              }
            })
          } catch (err) {
            console.warn('Failed to broadcast gift event:', err)
          }
        })()
      }

      // Refresh sender's profile
      // Use new_balance from RPC if available (Authoritative source) to avoid race conditions with DB read replica
      if (result.new_balance !== undefined) {
          if (profile) {
              const newData = {
                  troll_coins: result.new_balance,
                  is_gold: result.gold_awarded || profile.is_gold,
                  rgb_username_expires_at: result.rgb_awarded 
                    ? new Date(Date.now() + 30*24*60*60*1000).toISOString() 
                    : profile.rgb_username_expires_at
              };
              
              // Update Store AND CoinRotation Cache (locks polling for one cycle)
              useAuthStore.getState().setProfile({
                  ...profile,
                  ...newData
              });
              coinOptimizer.updateOptimisticBalance(user.id, newData);
          }
      } else {
          // Fallback for legacy RPC version
          const { data: updatedProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (updatedProfile) {
            useAuthStore.getState().setProfile(updatedProfile as any)
          }
      }

      // (Legacy Combo/Bonus Logic Removed per MASTER SYSTEM PROMPT)
      
      toast.success(`Gift sent: ${gift.name}`)

      // BROADCAST HUGE GIFT (Global Banner)
      if (gift.coinCost >= 500) {
        // Fire and forget - don't await this block to block UI
        (async () => {
          try {
            let receiverName = 'Someone';
            let receiverGlowingColor = null;
            if (targetReceiverId) {
              const { data: rData } = await supabase
                .from('user_profiles')
                .select('username, glowing_username_color')
                .eq('id', targetReceiverId)
                .single();
              if (rData) {
                receiverName = rData.username;
                receiverGlowingColor = rData.glowing_username_color;
              }
            }

            const channel = supabase.channel('global-gifts');
            channel.subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                await channel.send({
                  type: 'broadcast',
                  event: 'huge_gift',
                  payload: {
                    id: generateUUID(),
                    senderId: user.id,
                    receiverId: targetReceiverId,
                    senderName: profile.username || 'Anonymous',
                    senderGlowingColor: profile.glowing_username_color,
                    receiverName: receiverName,
                    receiverGlowingColor: receiverGlowingColor,
                    giftName: gift.name,
                    amount: gift.coinCost,
                    timestamp: Date.now()
                  }
                });
                // Short delay to ensure message goes out before cleanup
                setTimeout(() => supabase.removeChannel(channel), 1000);
              }
            });
          } catch (err) {
            console.error('Failed to broadcast huge gift:', err);
          }
        })();
      }
      
      try {
        if (gift.category === 'Family') {
          const { data: streamerMember } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', streamerId)
            .maybeSingle()

          const familyId = streamerMember?.family_id || null
          if (familyId) {
            const { data: activeWar } = await supabase
              .from('family_wars')
              .select('*')
              .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
              .in('status', ['pending', 'active'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (activeWar?.id) {
              const points = Math.max(1, Math.round(gift.coinCost / 100))
              await supabase
                .from('family_war_scores')
                .upsert({
                  war_id: activeWar.id,
                  family_id: familyId,
                  score: points,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'war_id,family_id' })
              
              // XP = war_points / 5
              const familyXp = Math.max(1, Math.round(points / 5))
              
              await supabase.rpc('increment_family_stats', {
                p_family_id: familyId,
                p_coin_bonus: Math.round(gift.coinCost * 0.05),
                p_xp_bonus: familyXp
              })
            }
          }
        }
      } catch (warErr) {
        console.warn('Family war gift handling failed', warErr)
      }
      
      // (Legacy Bonus Milestone Check Removed)

      // Identity event hook — Gift sent
      try {
        await supabase.rpc('record_dna_event', {
          p_user_id: user.id,
          p_event_type: 'SENT_CHAOS_GIFT',
          p_event_data: {
            gift_id: gift.id,
            coins: gift.coinCost,
            stream_id: streamId,
            streamer_id: streamerId
          }
        })
        
        // Process XP for Gifter and Streamer (New Logic)
        const { senderResult } = await processGiftXp(user.id, targetReceiverId, gift.coinCost)
        
        if (senderResult?.leveledUp) {
          toast.success(`🎉 Level Up! You reached Level ${senderResult.newLevel}!`)
          // Trigger badge toast if needed handled in processGiftXp via db, but UI toast here is good
        }
      } catch (err) {
        console.error('Error recording gift event:', err)
      }
      
      // Return bonus info if awarded, otherwise return true
      
      // Auto-track family task: Gift Raid (Gifts Sent)
      if (user?.id) {
        // Fire and forget
        supabase.rpc('track_family_event', { 
          p_user_id: user.id, 
          p_metric: 'gifts_sent', 
          p_increment: 1 
        }).then(({ error }) => {
          if (error) console.error('Error tracking family gift task:', error)
        })
      }

      return true
    } catch (err) {
      console.error('Gift send error:', err)
      toast.error('Failed to send gift')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return { sendGift, isSending }
}
