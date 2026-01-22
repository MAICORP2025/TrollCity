import { useState, useEffect, useCallback } from 'react'
import { Search, MessageCircle, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'

interface Conversation {
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  is_online?: boolean
  rgb_username_expires_at?: string | null
}

interface InboxSidebarProps {
  activeConversation: string | null
  onSelectConversation: (userId: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
  onlineUsers?: Record<string, boolean>
  onConversationsLoaded?: (conversations: Conversation[]) => void
  onNewMessage?: () => void
}

export default function InboxSidebar({
  activeConversation,
  onSelectConversation,
  activeTab,
  onTabChange,
  onlineUsers = {},
  onConversationsLoaded,
  onNewMessage
}: InboxSidebarProps) {
  const { profile } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const tabs = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'requests', label: 'Requests' },
    { id: 'officer', label: 'Officer Messages' },
    { id: 'broadcast', label: 'Broadcasts' },
    { id: 'system', label: 'System Alerts' }
  ]

  // Load unread counts
  const loadUnread = useCallback(async () => {
    if (!profile?.id) return
    setUnreadCounts({})
  }, [profile?.id])

  const deleteAllMessages = useCallback(async () => {
    if (!profile?.id) return
    
    if (!confirm('Delete ALL your conversations and messages? This cannot be undone.')) return
    
    try {
      // Get all conversation IDs where user is a member
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)
      
      const conversationIds = memberships?.map(m => m.conversation_id) || []
      
      if (conversationIds.length === 0) {
        toast.info('No conversations to delete')
        return
      }
      
      // Delete all messages in those conversations
      const { error: messagesError } = await supabase
        .from('conversation_messages')
        .delete()
        .in('conversation_id', conversationIds)
      
      if (messagesError) throw messagesError
      
      // Delete conversation memberships
      const { error: membershipsError } = await supabase
        .from('conversation_members')
        .delete()
        .eq('user_id', profile.id)
      
      if (membershipsError) throw membershipsError
      
      // Delete conversations themselves (if no other members)
      // This might fail if others are still members, which is okay
      await supabase
        .from('conversations')
        .delete()
        .in('id', conversationIds)
      
      setConversations([])
      onConversationsLoaded?.([])
      toast.success('All conversations deleted')
    } catch (err) {
      console.error('Delete all messages error:', err)
      toast.error('Failed to delete all messages')
    }
  }, [profile?.id, onConversationsLoaded])

  const loadConversations = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false
    if (!profile?.id) return

    try {
      if (!background) {
        setLoading(true)
      }

      if (activeTab === 'inbox') {
        // Load conversations using new schema
        const { data: myMemberships, error: membershipError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', profile.id)

        if (membershipError) throw membershipError

        const conversationIds = myMemberships?.map((m) => m.conversation_id) || []

        if (conversationIds.length === 0) {
          setConversations([])
          onConversationsLoaded?.([])
          if (!background) setLoading(false)
          return
        }

        // Get partners
        const { data: partners, error: partnersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id, user_profiles(username, avatar_url, rgb_username_expires_at)')
          .in('conversation_id', conversationIds)
          .neq('user_id', profile.id)

        if (partnersError) throw partnersError

        // Get latest messages (fetching one by one for now to ensure accuracy)
        // In a production app with many conversations, this should be optimized with a view or RPC
        const messagesPromises = conversationIds.map((cid) =>
          supabase
            .from('conversation_messages')
            .select('conversation_id, body, created_at, sender_id')
            .eq('conversation_id', cid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        )

        const messagesResults = await Promise.all(messagesPromises)
        const validMessages = messagesResults
          .map((res) => res.data)
          // Filter out nulls only if we strictly require a message, but we want to show empty conversations too
          // So we'll handle nulls in the loop below
          
        const newConversations: Conversation[] = []

        for (const cid of conversationIds) {
          const partner = partners?.find((p) => p.conversation_id === cid)
          const lastMsg = validMessages.find((m) => m?.conversation_id === cid)

          if (partner) {
            const profileData = partner.user_profiles as any
            
            newConversations.push({
              other_user_id: partner.user_id,
              other_username: profileData?.username || 'Unknown',
              other_avatar_url: profileData?.avatar_url || null,
              last_message: lastMsg?.body || 'Start a conversation',
              last_timestamp: lastMsg?.created_at || new Date().toISOString(), // Fallback to now if no messages
              unread_count: 0, // To be implemented with message_receipts
              rgb_username_expires_at: profileData?.rgb_username_expires_at
            })
          }
        }

        const sorted = newConversations.sort((a, b) => 
          new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()
        )
        setConversations(sorted)
        onConversationsLoaded?.(sorted)
      } else {
        // For other tabs, show filtered messages
        setConversations([])
        onConversationsLoaded?.([])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [profile?.id, activeTab, onConversationsLoaded])

  useEffect(() => {
    if (!profile?.id) return
    loadConversations()
    loadUnread()

    // Real-time subscription for new conversation messages
    const channel = supabase
      .channel('inbox_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages'
        },
        (payload) => {
          // Check if this message belongs to one of our conversations
          // Since we can't filter by multiple conversation_ids easily in one channel without knowing them all upfront,
          // we'll reload if we see any message. Optimally we'd filter.
          // But wait, we only care about messages where we are a member.
          // The payload has conversation_id. We can't know if we are a member easily without state.
          // Just reload for now.
          const _ = payload
          loadConversations({ background: true })
          loadUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, activeTab, loadConversations, loadUnread])

  useEffect(() => {
    if (!profile?.id) return

    const interval = setInterval(() => {
      loadConversations({ background: true })
      loadUnread()
    }, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [profile?.id, activeTab, loadConversations, loadUnread])

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return time.toLocaleDateString()
  }

  const filteredConversations = conversations.filter(conv =>
    conv.other_username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-full md:w-80 flex flex-col border-r border-[#8a2be2]/30 bg-[rgba(10,0,30,0.6)] h-full">
      {/* Tabs + Delete All Button */}
      <div className="border-b border-[#8a2be2]/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Messages</h2>
          {conversations.length > 0 && (
            <button
              onClick={deleteAllMessages}
              className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition flex items-center gap-1"
              title="Delete all conversations"
            >
              <Trash2 size={16} />
              <span className="text-xs">Delete All</span>
            </button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-none px-3 py-2 text-xs font-semibold rounded-full transition whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#9b32ff] to-[#00ffcc] text-black shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-[rgba(155,50,255,0.1)]'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* New Message Button */}
        <button
          type="button"
          onClick={onNewMessage}
          className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-[#9b32ff] to-[#00ffcc] text-black text-sm font-bold"
        >
          New Message
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-[#8a2be2]/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8a2be2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-3 py-2 bg-[rgba(10,0,30,0.6)] border border-[#8a2be2]/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8a2be2] focus:border-[#8a2be2]"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          // Show skeleton only on initial load, not during background refreshes
          <div className="divide-y divide-[#8a2be2]/20">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[#8a2be2]/20 flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#8a2be2]/20 rounded w-24"></div>
                  <div className="h-3 bg-[#8a2be2]/20 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <button
              type="button"
              onClick={onNewMessage}
              className="mt-3 px-4 py-2 rounded-lg bg-white/10 text-white text-xs"
            >
              Start a new message
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#8a2be2]/20">
            {filteredConversations.map((conv) => (
              <button
                key={conv.other_user_id}
                type="button"
                onClick={() => onSelectConversation(conv.other_user_id)}
                className={`
                  w-full p-3 flex items-center gap-3 hover:bg-[rgba(155,50,255,0.1)] transition
                  ${activeConversation === conv.other_user_id ? 'bg-[rgba(155,50,255,0.2)] border-l-2 border-[#8a2be2]' : ''}
                `}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.other_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.other_username}`}
                    alt={conv.other_username}
                    className="w-12 h-12 rounded-full border-2 border-[#8a2be2] hover:border-[#00ffcc] transition"
                  />
                  {onlineUsers[conv.other_user_id] ? (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#060011]"></span>
                  ) : (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-gray-500 border-2 border-[#060011]"></span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold text-sm truncate ${conv.rgb_username_expires_at && new Date(conv.rgb_username_expires_at) > new Date() ? 'rgb-username' : 'text-white'}`}>
                      @{conv.other_username}
                    </span>
                    <span className="text-xs text-[#74f7ff] ml-2 flex-shrink-0">
                      {formatTimeAgo(conv.last_timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 truncate flex-1">
                      {conv.last_message || 'No messages yet'}
                    </p>
                    {(unreadCounts[conv.other_user_id] || 0) > 0 && (
                      <div className="ml-auto flex items-center justify-center w-5 h-5 bg-purple-600 rounded-full text-white text-xs font-bold flex-shrink-0">
                        {unreadCounts[conv.other_user_id]}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
