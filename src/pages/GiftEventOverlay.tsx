import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { OFFICIAL_GIFTS, GiftItem } from '../lib/giftConstants'
import GiftSoundPlayer from './GiftSoundPlayer'

interface GiftEventOverlayProps {
  gift: any
}

interface EnhancedGift extends GiftItem {
  instanceId: string
  sender_username: string
  sender_avatar?: string
  receivedAt: number
}

export default function GiftEventOverlay({ gift }: GiftEventOverlayProps) {
  const [queue, setQueue] = useState<EnhancedGift[]>([])
  const [activeLargeGift, setActiveLargeGift] = useState<EnhancedGift | null>(null)
  const [smallGifts, setSmallGifts] = useState<EnhancedGift[]>([])

  // 1. Ingest Gifts
  useEffect(() => {
    if (!gift) return

    // Match with official list or fallback
    const official = OFFICIAL_GIFTS.find(g => g.id === gift.gift_id || g.name === gift.name) || {
      id: gift.gift_id || 'unknown',
      name: gift.name || 'Gift',
      cost: gift.coinCost || 0,
      tier: (gift.coinCost || 0) >= 10000 ? 'IV' : 'I',
      icon: '🎁',
      duration: (gift.coinCost || 0) >= 10000 ? 15 : 3
    }

    const enhancedGift: EnhancedGift = {
      ...official,
      instanceId: `${Date.now()}-${Math.random()}`,
      sender_username: gift.sender_username || 'Anonymous',
      sender_avatar: gift.sender_avatar,
      receivedAt: Date.now()
    }

    setQueue(prev => [...prev, enhancedGift])
  }, [gift])

  // 2. Process Queue
  useEffect(() => {
    if (queue.length === 0) return

    const nextGift = queue[0]
    const isLarge = nextGift.tier === 'IV' || nextGift.tier === 'V'

    if (isLarge) {
      if (!activeLargeGift) {
        // Play Large Gift
        setQueue(prev => prev.slice(1))
        setActiveLargeGift(nextGift)
        
        // Auto-clear
        setTimeout(() => {
          setActiveLargeGift(null)
        }, nextGift.duration * 1000)
      }
      // If busy, wait in queue
    } else {
      // Play Small Gift immediately (concurrent)
      setQueue(prev => prev.slice(1))
      setSmallGifts(prev => [...prev, nextGift])

      // Auto-remove
      setTimeout(() => {
        setSmallGifts(prev => prev.filter(g => g.instanceId !== nextGift.instanceId))
      }, nextGift.duration * 1000)
    }
  }, [queue, activeLargeGift])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">
      {/* Sound Player */}
      {(activeLargeGift || smallGifts.length > 0) && (
        <GiftSoundPlayer 
          giftId={activeLargeGift?.id || smallGifts[smallGifts.length - 1]?.id} 
          volume={0.5} 
        />
      )}

      {/* ZONE: Upper-Middle Third (Top 10% to 40%) */}
      <div className="absolute top-[10%] left-0 w-full h-[30%] flex flex-col items-center justify-center">
        
        {/* Small Gifts Stack (Tiers I-III) */}
        <div className="relative w-full h-full">
          <AnimatePresence>
            {smallGifts.map((g, i) => {
               // Random slight offset for "natural" stacking
               const randomX = (g.receivedAt % 100) - 50; 
               const randomY = (g.receivedAt % 50) - 25;
               
               return (
                <motion.div
                  key={g.instanceId}
                  initial={{ opacity: 0, scale: 0.5, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: randomY, x: randomX }}
                  exit={{ opacity: 0, scale: 1.5, y: -50 }}
                  transition={{ duration: 0.5 }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center"
                  style={{ zIndex: 10 + i }}
                >
                  <div className={`text-6xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-bounce`}>
                    {g.icon}
                  </div>
                  <div className="mt-2 bg-black/60 backdrop-blur-sm px-4 py-1 rounded-full border border-white/20 text-white text-sm font-bold flex items-center gap-2 shadow-xl">
                    <span className="text-yellow-400">{g.sender_username}</span> sent {g.name}
                  </div>
                </motion.div>
               )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ZONE: Center Screen (Tier IV-V) */}
      <AnimatePresence>
        {activeLargeGift && (
          <motion.div
            key={activeLargeGift.instanceId}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="absolute inset-0 flex items-center justify-center z-[200]"
          >
            {/* Background Effect (Non-blocking, transparent center) */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/80 pointer-events-none" />
            
            {/* Visuals */}
            <div className="relative flex flex-col items-center">
              {/* Premium Glow */}
              <div className="absolute inset-0 bg-yellow-500/20 blur-[100px] animate-pulse" />
              
              {/* Icon */}
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-9xl filter drop-shadow-[0_0_50px_rgba(255,215,0,0.8)] z-10"
              >
                {activeLargeGift.icon}
              </motion.div>

              {/* Text */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-8 text-center z-10"
              >
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 uppercase tracking-widest drop-shadow-sm">
                  {activeLargeGift.name}
                </div>
                <div className="mt-2 text-xl text-white font-bold bg-black/50 px-6 py-2 rounded-full border border-yellow-500/50 backdrop-blur-md">
                   Sent by <span className="text-yellow-400">{activeLargeGift.sender_username}</span>
                </div>
                
                {activeLargeGift.tier === 'V' && (
                  <div className="mt-4 text-sm text-yellow-200 animate-pulse font-mono">
                     LEGENDARY EVENT TRIGGERED
                  </div>
                )}
              </motion.div>

              {/* Particles / Confetti (CSS placeholder) */}
              <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                 {/* Can add particle system here later if needed */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
