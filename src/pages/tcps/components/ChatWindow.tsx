import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, createConversation, getConversationMessages, markConversationRead, OFFICER_GROUP_CONVERSATION_ID, getBlockedUserIds } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import MessageInput from './MessageInput'
import { Users, Info, Phone, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const MAX_MESSAGES = 5000 // Increased to fetch all messages

type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at?: string | null
  sender_username?: string
  sender_avatar_url?: string | null
  sender_rgb_expires_at?: string | null
  sender_glowing_username_color?: string | null
  sender_created_at?: string
  isPending?: boolean
}

interface ChatWindowProps {
  conversationId: string | null
  otherUserInfo: {
    id: string
    username: string
    avatar_url: string | null
    created_at?: string
    rgb_username_expires_at?: string | null
    glowing_username_color?: string | null
  } | null
  isOnline?: boolean
  onBack?: () => void
  onMessageSent?: () => void // Callback when a message is sent
  isGroup?: boolean
  groupConversationId?: string | null
  groupName?: string | null
  onOpenGroupInfo?: () => void
}

const ChatWindow = ({ otherUserInfo, isOnline, onBack, onMessageSent, isGroup = false, groupConversationId, groupName, onOpenGroupInfo }: ChatWindowProps) => {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [actualConversationId, setActualConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [callMinutes, setCallMinutes] = useState({ audio: 0, video: 0 })
  const [isInitiatingCall, setIsInitiatingCall] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const otherUserId = otherUserInfo?.id ?? null

  useEffect(() => {
    if (!user?.id) return

    const loadMinutes = async () => {
      try {
        const { data } = await supabase
          .from('call_minutes')
          .select('audio_minutes, video_minutes')
          .eq('user_id', user.id)
          .maybeSingle()

        setCallMinutes({
          audio: data?.audio_minutes || 0,
          video: data?.video_minutes || 0,
        })
      } catch (err) {
        console.error('Error loading call minutes:', err)
      }
    }

    void loadMinutes()
  }, [user?.id])

  const initiateCall = async (callType: 'audio' | 'video') => {
    if (!user?.id || !otherUserId || isGroup || isInitiatingCall) return

    const requiredMinutes = callType === 'audio' ? 1 : 2
    const availableMinutes = callType === 'audio' ? callMinutes.audio : callMinutes.video
    if (availableMinutes < requiredMinutes) {
      toast.error(`You don't have enough ${callType} minutes. Please purchase a package.`)
      return
    }

    setIsInitiatingCall(true)
    try {
      const roomId = crypto.randomUUID()
      const { error: roomError } = await supabase.from('call_rooms').insert({
        id: roomId,
        caller_id: user.id,
        receiver_id: otherUserId,
        type: callType,
        status: 'pending',
      })

      if (roomError) throw roomError

      const callerName = (profile as any)?.display_name || profile?.username || 'Someone'
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: otherUserId,
        type: 'call',
        title: 'Incoming Call',
        message: `${callerName} is calling you`,
        metadata: {
          caller_id: user.id,
          caller_username: callerName,
          caller_avatar: profile?.avatar_url || null,
          call_type: callType,
          room_id: roomId,
        },
      })

      if (notificationError) throw notificationError
      navigate(`/call/${roomId}/${callType}/${otherUserId}`)
    } catch (err) {
      console.error('Error initiating TCPS call:', err)
      toast.error('Failed to start call. Please try again.')
    } finally {
      setIsInitiatingCall(false)
    }
  }

  const mapConversationMessages = useCallback(async (conversationId: string) => {
    const rows = await getConversationMessages(conversationId, { limit: MAX_MESSAGES })
    if (!rows || rows.length === 0) return []

    // Get blocked user IDs to filter their messages
    const blockedIds = await getBlockedUserIds()
    const blockedSet = new Set(blockedIds)

    // Filter out messages from blocked users (but keep own messages)
    const filteredRows = rows.filter(m => m.sender_id === user?.id || !blockedSet.has(m.sender_id))

    const senderIds = Array.from(new Set(filteredRows.map((m) => m.sender_id)))
    const { data: senders, error: sendersError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
      .in('id', senderIds)

    if (sendersError) {
      console.error('Error fetching message senders:', sendersError)
    }

    const senderMap: Record<string, any> = {}
    senders?.forEach((s) => {
      senderMap[s.id] = s
    })

    return filteredRows
      .map((m) => {
        // Prefer cached senderMap; fall back to known values for self/other
        let username = senderMap[m.sender_id]?.username
        const display_name = senderMap[m.sender_id]?.display_name
        let avatar_url = senderMap[m.sender_id]?.avatar_url
        let rgb_exp = senderMap[m.sender_id]?.rgb_username_expires_at
        let glow_color = senderMap[m.sender_id]?.glowing_username_color
        let created_at = senderMap[m.sender_id]?.created_at

        // Fallback: if map missing but it's self or the known other user, use known info
        if (!username || username === '') {
          if (m.sender_id === user?.id && profile) {
            username = profile.username || (profile as any).display_name
            avatar_url = profile.avatar_url
            rgb_exp = profile.rgb_username_expires_at
            glow_color = profile.glowing_username_color
            created_at = profile.created_at
          } else if (m.sender_id === otherUserId && otherUserInfo) {
            username = otherUserInfo.username || (otherUserInfo as any)?.display_name
            avatar_url = otherUserInfo.avatar_url
            rgb_exp = otherUserInfo.rgb_username_expires_at
            glow_color = otherUserInfo.glowing_username_color
            created_at = otherUserInfo.created_at
          } else {
            // Fallback chain: display_name → username → formatted user ID
            username = display_name || username || `user${m.sender_id.slice(0, 6)}`
            avatar_url = null
          }
        }

        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          content: (m as any).body || (m as any).content,
          created_at: m.created_at,
          read_at: (m as any).read_at ?? null,
          sender_username: username,
          sender_avatar_url: avatar_url,
          sender_rgb_expires_at: rgb_exp,
          sender_glowing_username_color: glow_color,
          sender_created_at: created_at,
        }
      })
      .reverse()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setActualConversationId(null)
      setMessages([])
      return
    }

    // Group chat: use the provided conversation ID directly
    if (isGroup && groupConversationId) {
      setActualConversationId(groupConversationId)
      return
    }

    if (!otherUserId) {
      setActualConversationId(null)
      setMessages([])
      return
    }

    if (otherUserId === OFFICER_GROUP_CONVERSATION_ID) {
      setActualConversationId(OFFICER_GROUP_CONVERSATION_ID)
      setMessages([])
      return
    }

    let mounted = true
    const init = async () => {
      try {
        // Single RPC call replaces batched conversation_members lookup
        const { data: foundConvId, error: rpcError } = await supabase
          .rpc('find_shared_conversation', { p_user_id: user.id, p_other_user_id: otherUserId })

        if (rpcError) throw rpcError

        let targetConvId: string | null = foundConvId || null

        if (!targetConvId) {
          const newConv = await createConversation([otherUserId])
          targetConvId = newConv.id
        }

        if (mounted) {
          setActualConversationId(targetConvId)
        }
      } catch (e) {
        console.error('Error initializing conversation:', e)
        if (mounted) {
          setActualConversationId(null)
        }
      }
    }

    void init()
    return () => {
      mounted = false
    }
  }, [otherUserId, user?.id, isGroup, groupConversationId])

  useEffect(() => {
    if (!actualConversationId) return

    let mounted = true

    const load = async () => {
      try {
        const mapped = await mapConversationMessages(actualConversationId)
        if (mounted) setMessages(mapped)
        await markConversationRead(actualConversationId)
      } catch (e) {
        console.error('Error loading messages:', e)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [actualConversationId, mapConversationMessages])

  useEffect(() => {
    if (!actualConversationId) return

    const channel = supabase.channel(`tcps:${actualConversationId}`)

    const handleNewMessage = async (payload: any) => {
      const newMsgRaw = payload.new || payload.payload
      if (!newMsgRaw) return

      const senderId = newMsgRaw.sender_id

       let senderInfo: any = null
       if (senderId === profile?.id && profile) {
         senderInfo = {
           id: profile.id,
           username: profile.username,
           avatar_url: profile.avatar_url,
           rgb_username_expires_at: profile.rgb_username_expires_at,
           glowing_username_color: profile.glowing_username_color,
           created_at: profile.created_at,
         }
       } else if (senderId === otherUserId && otherUserInfo?.username) {
         // Only use cached otherUserInfo if username is actually loaded
         senderInfo = {
           id: otherUserInfo.id,
           username: otherUserInfo.username,
           avatar_url: otherUserInfo.avatar_url,
           rgb_username_expires_at: otherUserInfo.rgb_username_expires_at,
           glowing_username_color: otherUserInfo.glowing_username_color,
           created_at: otherUserInfo.created_at,
         }
       } else {
         // Fallback: fetch profile from DB
         const { data } = await supabase
           .from('user_profiles')
           .select('id, username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
           .eq('id', senderId)
           .maybeSingle()
         senderInfo = data
       }

      const newMsg: ChatMessage = {
        id: newMsgRaw.id,
        conversation_id: newMsgRaw.conversation_id,
        sender_id: newMsgRaw.sender_id,
        content: newMsgRaw.body ?? newMsgRaw.content,
        created_at: newMsgRaw.created_at,
        read_at: newMsgRaw.read_at ?? null,
        sender_username: senderInfo?.username,
        sender_avatar_url: senderInfo?.avatar_url,
        sender_rgb_expires_at: senderInfo?.rgb_username_expires_at,
        sender_glowing_username_color: senderInfo?.glowing_username_color,
        sender_created_at: senderInfo?.created_at,
      }

      setMessages((prev) => {
        const withoutPending = prev.filter((m) => {
          if (!m.isPending) return true
          return !(m.sender_id === newMsg.sender_id && m.content === newMsg.content)
        })

        if (withoutPending.some((m) => m.id === newMsg.id)) return withoutPending

        const updated = [...withoutPending, newMsg]
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES)
        return updated
      })

      if (newMsgRaw.sender_id !== profile?.id) {
        try {
          await markConversationRead(actualConversationId)
        } catch {
          // ignore
        }
      }
    }

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${actualConversationId}`,
        },
        handleNewMessage
      )
      .on('broadcast', { event: 'new-message' }, handleNewMessage)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [actualConversationId, otherUserId, otherUserInfo, profile])

  useEffect(() => {
    if (virtuosoRef.current && messages.length > 0) {
      virtuosoRef.current.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
    }
  }, [messages])

  const handleNewMessageOptimistic = (msg: any) => {
    if (!actualConversationId || !profile?.id) return

    const pending: ChatMessage = {
      id: msg.id || `temp-${Date.now()}`,
      conversation_id: actualConversationId,
      sender_id: profile.id,
      content: msg.content || msg.body,
      created_at: msg.created_at || new Date().toISOString(),
      read_at: null,
      sender_username: profile.username,
      sender_avatar_url: profile.avatar_url,
      sender_rgb_expires_at: profile.rgb_username_expires_at,
      sender_glowing_username_color: profile.glowing_username_color,
      sender_created_at: profile.created_at,
      isPending: true,
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === pending.id)) return prev
      const updated = [...prev, pending]
      if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES)
      return updated
    })
  }

  if (!user?.id) return null

  if (!otherUserId && !isGroup) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 h-full">Select a conversation</div>
  }

  if (!actualConversationId) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header with user/group info */}
        {(otherUserInfo || isGroup) && (
          <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/10">
            <button
              onClick={() => window.history.back()}
              className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white"
            >
              ←
            </button>
            {isGroup ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                <Users className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                {otherUserInfo?.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <div className="font-semibold text-white">
                {isGroup ? (groupName || 'Group Chat') : (otherUserInfo?.username || 'Loading...')}
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading conversation...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A14]">
      {/* Header with user/group info */}
      {(otherUserInfo || isGroup) && (
        <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/10 shrink-0">
          {/* Back button for mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0">
              <Users className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold shrink-0">
              {otherUserInfo?.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">
              {isGroup ? (groupName || 'Group Chat') : (otherUserInfo?.username || 'Unknown User')}
            </div>
            {!isGroup && isOnline !== undefined && (
              <div className="text-xs flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className={isOnline ? 'text-green-400' : 'text-gray-500'}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            )}
            {isGroup && (
              <div className="text-xs text-purple-400">Group Chat</div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {!isGroup && otherUserId && (
              <>
                <button
                  onClick={() => initiateCall('audio')}
                  disabled={isInitiatingCall}
                  className="p-2 hover:bg-green-500/20 rounded-lg transition-colors text-gray-400 hover:text-green-400 disabled:opacity-50"
                  title={`Audio call (${callMinutes.audio} min available)`}
                  aria-label="Start audio call"
                  type="button"
                >
                  <Phone size={18} />
                </button>
                <button
                  onClick={() => initiateCall('video')}
                  disabled={isInitiatingCall}
                  className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-gray-400 hover:text-blue-400 disabled:opacity-50"
                  title={`Video call (${callMinutes.video} min available)`}
                  aria-label="Start video call"
                  type="button"
                >
                  <Video size={18} />
                </button>
              </>
            )}
            {isGroup && onOpenGroupInfo && (
              <button
                onClick={onOpenGroupInfo}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Group Info"
              >
                <Info size={18} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex-grow overflow-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">No messages yet</div>
        ) : (
          <div className="h-full overflow-auto">
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              initialTopMostItemIndex={messages.length - 1}
              followOutput="smooth"
              itemContent={(_index, msg) => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 px-4`}>
                    <div 
                      className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                        isMe 
                          ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-br-md' 
                          : 'bg-white/10 text-gray-100 rounded-bl-md'
                      }`}
                    >
                      {!isMe && (
                        <div className="text-xs text-purple-300 mb-1 font-medium">
                          {msg.sender_username || `user${msg.sender_id?.slice(0, 6)}`}
                        </div>
                      )}
                      <div className="text-sm break-words">{msg.content}</div>
                      <div className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          </div>
        )}
      </div>
      <MessageInput
        conversationId={actualConversationId}
        otherUserId={otherUserId}
        isGroup={isGroup}
        onMessageSent={() => {
          if (actualConversationId) {
            void markConversationRead(actualConversationId).catch(() => {})
          }
          // Notify parent to refresh sidebar
          if (onMessageSent) {
            onMessageSent()
          }
        }}
        onNewMessage={handleNewMessageOptimistic}
      />
    </div>
  )
}

export default ChatWindow
