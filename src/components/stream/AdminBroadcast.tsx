import { motion, AnimatePresence } from 'framer-motion'
import { Crown, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { translateMessage } from '../../lib/translation'

interface AdminBroadcastProps {
  message: string
  userLanguage?: string
  onClose?: () => void
  broadcastId?: string
}

export default function AdminBroadcast({ message, userLanguage = 'en', onClose, broadcastId }: AdminBroadcastProps) {
  const [translatedMessage, setTranslatedMessage] = useState(message)

  useEffect(() => {
    // Translate message if user has a different language preference
    if (userLanguage && userLanguage !== 'en') {
      translateMessage(message, userLanguage)
        .then(translated => {
          if (translated && translated !== message) {
            setTranslatedMessage(translated)
          }
        })
        .catch(err => {
          console.error('Translation error:', err)
          setTranslatedMessage(message) // Fallback to original
        })
    } else {
      setTranslatedMessage(message)
    }
  }, [message, userLanguage])

  const handleClose = () => {
    // Mark broadcast as dismissed in localStorage
    if (broadcastId) {
      try {
        const dismissedBroadcasts = JSON.parse(localStorage.getItem('dismissedBroadcasts') || '[]')
        if (!dismissedBroadcasts.includes(broadcastId)) {
          dismissedBroadcasts.push(broadcastId)
          localStorage.setItem('dismissedBroadcasts', JSON.stringify(dismissedBroadcasts))
        }
      } catch (e) {
        console.error('Error saving dismissed broadcast:', e)
      }
    }
    if (onClose) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.95 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 admin-broadcast-popup bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-md border border-purple-500/50 rounded-xl p-4 shadow-2xl max-w-md w-[calc(100vw-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">ADMIN ANNOUNCEMENT</span>
              <div className="text-base font-semibold text-gray-100 mt-1">{translatedMessage}</div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1"
              title="Close announcement"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

