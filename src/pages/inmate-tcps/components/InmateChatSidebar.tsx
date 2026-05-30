import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Mail, MessageCircle, Lock } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'

interface SidebarConversation {
  conversation_id: string
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  rgb_username_expires_at?: string | null
  glowing_username_color?: string | null
  other_created_at?: string
}

interface InmateChatSidebarProps {
  activeConversationId: string | null
  onSelectConversation: (conversationId: string, otherUserId: string, otherUsername: string, otherAvatarUrl: string | null) => void
  refreshKey?: number
}

export default function InmateChatSidebar({
  activeConversationId,
  onSelectConversation,
  refreshKey,
}: InmateChatSidebarProps) {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<SidebarConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const isFetchingRef = useRef(false)
  const lastFetchTimeRef = useRef(0)

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return

    const now = Date.now()
    if (lastFetchTimeRef.current && now - lastFetchTimeRef.current < 1000) return
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    lastFetchTimeRef.current = now

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_conversations_optimized', { p_user_id: user.id })

      if (rpcError) throw rpcError

      const convs: SidebarConversation[] = (rpcData || []).map((c: any) => ({
        conversation_id: c.conversation_id,
        other_user_id: c.other_user_id,
        other_username: c.other_username || `user${c.other_user_id?.slice(0, 6)}`,
        other_avatar_url: c.other_avatar_url || null,
        last_message: c.last_message || 'No messages yet',
        last_timestamp: c.last_timestamp || '',
        unread_count: c.unread_count || 0,
        rgb_username_expires_at: c.rgb_username_expires_at,
        glowing_username_color: c.glowing_username_color,
        other_created_at: c.other_created_at,
      }))

      convs.sort((a, b) => {
        const timeA = a.last_timestamp && a.last_timestamp !== '1970-01-01T00:00:00+00:00'
          ? new Date(a.last_timestamp).getTime() : 0
        const timeB = b.last_timestamp && b.last_timestamp !== '1970-01-01T00:00:00+00:00'
          ? new Date(b.last_timestamp).getTime() : 0
        return timeB - timeA
      })

      setConversations(convs)
    } catch (err) {
      console.error('Error fetching inmate conversations:', err)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [user?.id])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchConversations()
    }
  }, [refreshKey, fetchConversations])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('inmate-tcps-sidebar')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
        },
        (payload) => {
          const msg = payload.new as any
          if (msg.sender_id !== user.id) {
            setConversations((prev) =>
              prev.map((c) =>
                c.conversation_id === msg.conversation_id
                  ? {
                      ...c,
                      last_message: msg.body || '',
                      last_timestamp: msg.created_at,
                      unread_count: activeConversationId === msg.conversation_id ? 0 : c.unread_count + 1,
                    }
                  : c
              )
            )
          }
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchConversations, activeConversationId])

  const filtered = conversations.filter((c) =>
    c.other_username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-950/80">
      <div className="space-y-3 border-b border-zinc-800 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-700/40 bg-cyan-950/40">
            <Mail className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-100">Inmate Mail</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Monitored communication</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-cyan-700"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-zinc-800" />
                  <div className="h-3 w-full rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Lock className="mb-3 h-10 w-10 text-zinc-700" />
            <p className="text-sm font-bold text-zinc-400">No conversations</p>
            <p className="mt-1 text-xs text-zinc-600">
              {searchQuery ? 'No matches found' : 'Messages from others will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((conv) => {
              const isActive = activeConversationId === conv.conversation_id
              const hasUnread = conv.unread_count > 0

              return (
                <button
                  key={conv.conversation_id}
                  type="button"
                  onClick={() =>
                    onSelectConversation(
                      conv.conversation_id,
                      conv.other_user_id,
                      conv.other_username,
                      conv.other_avatar_url
                    )
                  }
                  className={`relative flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-zinc-900/60 ${
                    isActive ? 'bg-zinc-900/80' : ''
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 h-full w-[3px] bg-cyan-500" />
                  )}

                  <div className="relative shrink-0">
                    <div
                      className={`h-11 w-11 overflow-hidden rounded-full border ${
                        hasUnread ? 'border-cyan-500/60 ring-2 ring-cyan-500/30' : 'border-zinc-700'
                      } bg-zinc-800`}
                    >
                      {conv.other_avatar_url ? (
                        <img
                          src={conv.other_avatar_url}
                          alt={conv.other_username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
                          {conv.other_username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {hasUnread && (
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white ring-2 ring-zinc-950">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${hasUnread ? 'font-black text-white' : 'font-bold text-zinc-200'}`}>
                        {conv.other_username}
                      </span>
                      {conv.last_timestamp && conv.last_timestamp !== '1970-01-01T00:00:00+00:00' && (
                        <span className="shrink-0 text-[10px] text-zinc-600">
                          {new Date(conv.last_timestamp).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${hasUnread ? 'font-bold text-zinc-300' : 'text-zinc-500'}`}>
                      {conv.last_message}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
