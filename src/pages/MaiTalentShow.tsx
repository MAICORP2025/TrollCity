import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Play, Pause, Gift, Users, MessageCircle, X, Send, Star, Heart, Zap, Trophy, Crown, Mic, Music, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'

const COLORS = {
  black: '#050505',
  darkBlack: '#0d0d0d',
  gold: '#FFD54A',
  red: '#FF2D2D',
  orange: '#FF7A00',
  purple: '#9333ea',
}

interface MTShow {
  id: string
  title: string
  status: string
  start_time: string
  host_id: string
  performance_duration: number
}

interface Performer {
  id: string
  username: string
  avatar_url: string
}

const GIFTS = [
  { id: 1, name: 'Roses', emoji: '🌹', cost: 10, type: 'roses' },
  { id: 2, name: 'Hearts', emoji: '❤️', cost: 15, type: 'hearts' },
  { id: 3, name: 'Thumbs Up', emoji: '👍', cost: 20, type: 'thumbs' },
  { id: 4, name: 'Star', emoji: '⭐', cost: 50, type: 'star' },
  { id: 5, name: 'Fire', emoji: '🔥', cost: 75, type: 'fire' },
  { id: 6, name: 'Diamond', emoji: '💎', cost: 100, type: 'diamond' },
  { id: 7, name: 'Crown', emoji: '👑', cost: 200, type: 'crown' },
  { id: 8, name: 'Trophy', emoji: '🏆', cost: 500, type: 'trophy' },
]

export default function MaiTalentShow() {
  const { id } = useParams()
  const { profile } = useAuthStore()
  const { balances } = useCoins()
  const navigate = useNavigate()
  
  const [show, setShow] = useState<MTShow | null>(null)
  const [performers, setPerformers] = useState<Performer[]>([])
  const [loading, setLoading] = useState(true)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [selectedPerformer, setSelectedPerformer] = useState<Performer | null>(null)
  const [sendingGift, setSendingGift] = useState(false)
  const [messages, setMessages] = useState<{id: string, user: string, text: string, time: string}[]>([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    loadShow()
  }, [id])

  const loadShow = async () => {
    setLoading(true)
    try {
      const { data: showData } = await supabase
        .from('mt_shows')
        .select('*')
        .eq('id', id)
        .single()
      
      if (showData) setShow(showData)

      const { data: queueData } = await supabase
        .from('mt_show_queue')
        .select('user_id, position, status')
        .eq('show_id', id)
        .eq('status', 'waiting')
        .order('position', { ascending: true })
        .limit(10)
      
      if (queueData && queueData.length > 0) {
        const userIds = queueData.map(q => q.user_id).filter(Boolean)
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', userIds)
          setPerformers(profiles || [])
        }
      }
    } catch (err) {
      console.error('Error loading show:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!profile?.id) {
      navigate('/auth')
      return
    }

    if (!selectedPerformer) {
      alert('Select a performer to send gift to!')
      return
    }

    setSendingGift(true)
    try {
      if ((balances?.trollCoins || 0) < gift.cost) {
        alert('Not enough coins!')
        setSendingGift(false)
        return
      }

      const { error } = await supabase.from('mt_gifts_sent').insert({
        sender_id: profile.id,
        performer_id: selectedPerformer.id,
        coin_value: gift.cost,
        show_id: id
      })

      if (error) throw error
      alert(`Gift sent: ${gift.emoji} ${gift.name}!`)
      setShowGiftModal(false)
      setSelectedPerformer(null)
    } catch (err) {
      console.error('Error sending gift:', err)
      alert('Failed to send gift')
    } finally {
      setSendingGift(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !profile?.id) return

    const msg = {
      id: Date.now().toString(),
      user: profile.username || 'User',
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages([...messages, msg])
    setNewMessage('')
  }

  const isHost = profile?.id === show?.host_id

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.black }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-pink-400 text-lg">Loading Show...</p>
        </div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.black }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Show Not Found</h1>
          <Link to="/mai-talent" className="text-pink-400 hover:text-pink-300">Back to Mai Talent</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.black }}>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative" style={{ background: 'linear-gradient(180deg, #0d0d0d 0%, #050505 100%)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {show.status === 'live' ? (
              <div className="text-center">
                <div className="w-32 h-32 rounded-full flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.red} 100%)`, boxShadow: `0 0 40px rgba(236, 72, 153, 0.5)` }}>
                  <Crown size={64} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{show.title || 'Live Show'}</h1>
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 font-bold">LIVE</span>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-32 h-32 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.darkBlack, border: `2px solid ${COLORS.gold}` }}>
                  <Calendar size={64} className="text-yellow-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{show.title || 'Upcoming Show'}</h1>
                <p className="text-gray-400">Show starts at {show.start_time ? new Date(show.start_time).toLocaleString() : 'TBD'}</p>
              </div>
            )}
          </div>

          {isHost && (
            <div className="absolute top-4 left-4">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold" style={{ backgroundColor: COLORS.red, color: 'white' }}>
                <Pause size={18} />
                End Show
              </button>
            </div>
          )}
        </div>

        <div className="h-48 border-t border-white/10" style={{ backgroundColor: COLORS.darkBlack }}>
          <div className="p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3">PERFORMERS</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {performers.length > 0 ? performers.map(perf => (
                <button
                  key={perf.id}
                  onClick={() => { setSelectedPerformer(perf); setShowGiftModal(true) }}
                  className="flex-shrink-0 flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden mb-2" style={{ border: `2px solid ${COLORS.pink}` }}>
                    <img src={perf.avatar_url || `https://i.pravatar.cc/150?u=${perf.id}`} alt={perf.username} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-white">{perf.username}</span>
                </button>
              )) : (
                <p className="text-gray-500">No performers in queue</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-80 border-l border-white/10 flex flex-col" style={{ backgroundColor: COLORS.darkBlack }}>
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-white">LIVE CHAT</h3>
          <span className="text-xs text-gray-500">{messages.length} messages</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className="text-sm">
              <span className="text-pink-400 font-bold">{msg.user}:</span>
              <span className="text-white ml-2">{msg.text}</span>
              <span className="text-gray-600 text-xs ml-2">{msg.time}</span>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No messages yet</p>
          )}
        </div>

        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Send a message..."
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/10 text-white placeholder-gray-500 border border-white/20 focus:border-pink-500 focus:outline-none"
            />
            <button onClick={handleSendMessage} className="p-2 rounded-lg" style={{ backgroundColor: COLORS.purple }}>
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="rounded-xl p-6 max-w-md w-full mx-4" style={{ backgroundColor: COLORS.darkBlack, border: `1px solid ${COLORS.pink}` }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Send Gift</h2>
              <button onClick={() => { setShowGiftModal(false); setSelectedPerformer(null) }} className="p-1">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            {selectedPerformer && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/5">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img src={selectedPerformer.avatar_url || `https://i.pravatar.cc/150?u=${selectedPerformer.id}`} alt={selectedPerformer.username} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-white">{selectedPerformer.username}</p>
                  <p className="text-sm text-pink-400">Send a gift</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {GIFTS.map(gift => (
                <button
                  key={gift.id}
                  onClick={() => handleSendGift(gift)}
                  disabled={sendingGift}
                  className="flex flex-col items-center p-3 rounded-lg transition-all hover:scale-105"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <span className="text-2xl mb-1">{gift.emoji}</span>
                  <span className="text-xs text-white">{gift.name}</span>
                  <span className="text-xs text-yellow-400">{gift.cost}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-white/5 flex items-center justify-between">
              <span className="text-gray-400">Your Balance</span>
              <span className="text-yellow-400 font-bold">{balances?.trollCoins?.toLocaleString() || 0} Coins</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Calendar({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}