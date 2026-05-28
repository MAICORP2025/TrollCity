import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'

interface HypeCoinPopupProps {
  isVisible: boolean
  onDismiss: () => void
}

/**
 * Popup notification shown when viewer earns a Hype Coin
 * Auto-dismisses after 5 seconds
 * Shows +1 Hype Coin with neon cyan/purple styling
 */
export default function HypeCoinPopup({ isVisible, onDismiss }: HypeCoinPopupProps) {
   const [displayKey, setDisplayKey] = useState(0)

   // Auto-dismiss after 5 seconds
   useEffect(() => {
     if (isVisible) {
       const timer = setTimeout(() => {
         onDismiss()
       }, 5000)
       return () => clearTimeout(timer)
     }
   }, [isVisible, onDismiss])

  // Reset display key to trigger re-animation on each new popup
  useEffect(() => {
    if (isVisible) {
      setDisplayKey((prev) => prev + 1)
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={`hype-popup-${displayKey}`}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300, duration: 0.3 }}
          className="fixed bottom-24 right-6 md:bottom-32 md:right-8 z-50 pointer-events-none"
        >
          <div className="relative">
            {/* Glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 rounded-2xl blur-xl opacity-40" />

            {/* Main card */}
            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-2xl border border-cyan-400/60 px-6 py-4 shadow-[0_0_40px_rgba(34,211,238,0.3)]">
              {/* Content */}
              <div className="flex items-center gap-3">
                {/* Lightning icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/40 rounded-lg blur-lg" />
                  <div className="relative bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg p-1.5 shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Text content */}
                <div>
                  <div className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-cyan-300 tracking-wide">
                    +1 HYPE COIN
                  </div>
                  <div className="text-xs text-cyan-200/80 font-semibold leading-tight">
                    You earned it watching live
                  </div>
                </div>
              </div>

              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

              {/* Optional: Subtle sparkles */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-cyan-300 rounded-full"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.3,
                  }}
                  style={{
                    left: `${20 + i * 30}%`,
                    top: `-4px`,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
