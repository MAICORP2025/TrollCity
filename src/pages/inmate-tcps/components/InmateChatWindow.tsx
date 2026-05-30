import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, getConversationMessages, markConversationRead, OFFICER_GROUP_CONVERSATION_ID } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import InmateMessageInput from './InmateMessageInput'
import { Shield, User } from 'lucide-react'

const MAX_MESSAGES = 5000

interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at?: string | null
  sender_username?: string
  sender_avatar_url?: string | null
  isPending?: boolean
}

interface InmateChatWindowProps {
  conversationId: string | null
  otherUserId: string | null
  otherUsername: string | null
  otherAvatarUrl: string | null
  onBack?: () => void
  onMessageSent?: () => void
}

export default function InmateChatWindow({
  conversationId,
  otherUserId,
  otherUsername,
  otherAvatarUrl,
  onBack,
  onMessageSent,
}: InmateChatWindowProps) {
  const { user, profile } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const mapConversationMessages = useCallback(async (convId: string) => {
    const rows = await getConversationMessages(convId, { limit: MAX_MESSAGES })
    if (!rows || rows.length === 0) return []

    const senderIds = Array.from(new Set(rows.map((m) => m.sender_id)))
    const { data: senders } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', senderIds)

    const senderMap: Record<string, any> = {}
    senders?.forEach((s) => {
      senderMap[s.id] = s
    })

    return rows
      .map((m) => {
        let username = senderMap[m.sender_id]?.display_name || senderMap[m.sender_id]?.username
        let avatar = senderMap[m.sender_id]?.avatar_url

        if (!username) {
          if (m.sender_id === user?.id && profile) {
            username = profile.username || (profile as any).display_name
            avatar = profile.avatar_url
          } else if (m.sender_id === otherUserId) {
            username = otherUsername || 'Unknown'
            avatar = otherAvatarUrl
          } else {
            username = `user${m.sender_id.slice(0, 6)}`
          }
        }

        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          content: m.body,
          created_at: m.created_at,
          read_at: m.read_at ?? null,
          sender_username: username,
          sender_avatar_url: avatar,
        }
      })
      .reverse()
  }, [user?.id, profile, otherUserId, otherUsername, otherAvatarUrl])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    let mounted = true
    const load = async () => {
      try {
        const mapped = await mapConversationMessages(conversationId)
        if (mounted) setMessages(mapped)
        await markConversationRead(conversationId)
      } catch (e) {
        console.error('Error loading messages:', e)
      }
    }
    void load()

    return () => {
      mounted = false
    }
  }, [conversationId, mapConversationMessages])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase.channel(`inmate-tcps:${conversationId}`)

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsgRaw = payload.new
          if (!newMsgRaw) return

          const senderId = newMsgRaw.sender_id
          let senderInfo: any = null

          if (senderId === profile?.id && profile) {
            senderInfo = { username: profile.username, avatar_url: profile.avatar_url }
          } else if (senderId === otherUserId) {
            senderInfo = { username: otherUsername, avatar_url: otherAvatarUrl }
          } else {
            const { data } = await supabase
              .from('user_profiles')
              .select('username, avatar_url')
              .eq('id', senderId)
              .maybeSingle()
            senderInfo = data
          }

          const newMsg: ChatMessage = {
            id: newMsgRaw.id,
            conversation_id: newMsgRaw.conversation_id,
            sender_id: newMsgRaw.sender_id,
            content: newMsgRaw.body,
            created_at: newMsgRaw.created_at,
            read_at: newMsgRaw.read_at ?? null,
            sender_username: senderInfo?.username || `user${senderId?.slice(0, 6)}`,
            sender_avatar_url: senderInfo?.avatar_url || null,
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          if (senderId !== profile?.id) {
            try {
              await markConversationRead(conversationId)
            } catch { /* ignore */ }
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, otherUserId, otherUsername, otherAvatarUrl, profile])

  useEffect(() => {
    if (virtuosoRef.current && messages.length > 0) {
      virtuosoRef.current.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
    }
  }, [messages])

  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-500">
        <Shield className="mb-4 h-14 w-14 text-zinc-700" />
        <p className="text-sm font-bold text-zinc-400">Select a conversation</p>
        <p className="mt-1 text-xs text-zinc-600">Choose from your monitored messages</p>
      </div>
    )
  }

  const isOfficerConv = otherUserId === OFFICER_GROUP_CONVERSATION_ID

  return (
    <div className="flex h-full flex-col bg-black/20">
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/50 p-4">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 md:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}

        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
          {isOfficerConv ? (
            <Shield className="h-4 w-4 text-cyan-300" />
          ) : otherAvatarUrl ? (
            <img src={otherAvatarUrl} alt={otherUsername || ''} className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-zinc-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-100">
            {otherUsername || 'Unknown'}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
            Monitored Chat
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            No messages in this conversation yet
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            initialTopMostItemIndex={messages.length - 1}
            followOutput="smooth"
            className="h-full"
            itemContent={(_index, msg) => {
              const isMe = msg.sender_id === user?.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 px-4`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? 'rounded-br-md bg-cyan-700/50 text-zinc-100'
                        : 'rounded-bl-md bg-zinc-800/80 text-zinc-200'
                    } ${msg.isPending ? 'opacity-60' : ''}`}
                  >
                    {!isMe && (
                      <p className="mb-0.5 text-[10px] font-bold text-cyan-400/80">
                        {msg.sender_username || 'Unknown'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                    <p className={`mt-1 text-[10px] ${isMe ? 'text-cyan-300/50' : 'text-zinc-600'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            }}
          />
        )}
      </div>

      <InmateMessageInput
        conversationId={conversationId}
        onMessageSent={() => {
          if (conversationId) {
            void markConversationRead(conversationId).catch(() => {})
          }
          onMessageSent?.()
        }}
      />
    </div>
  )
}
