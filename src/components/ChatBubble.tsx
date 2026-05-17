import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X,
  Minus,
  CheckCheck,
  Shield,
  Clock,
  Phone,
  Video,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import {
  supabase,
  createConversation,
  getConversationMessages,
  markConversationRead,
  OFFICER_GROUP_CONVERSATION_ID,
} from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useChatStore } from '../lib/chatStore'
import { usePresenceStore } from '../lib/presenceStore'
import UserNameWithAge from './UserNameWithAge'
import MessageInput from '../pages/tcps/components/MessageInput'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'

interface Message {
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

export default function ChatBubble() {
  const { user, profile } = useAuthStore()
  const {
    isOpen,
    isMinimized,
    activeUserId,
    activeUsername,
    activeUserAvatar,
    closeChatBubble,
    toggleMinimize,
  } = useChatStore()
  const { onlineUserIds } = usePresenceStore()
  const navigate = useNavigate()

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [actualConversationId, setActualConversationId] = useState<string | null>(null)
  const [isTyping, _setIsTyping] = useState(false)
  const [isOpsConversation, setIsOpsConversation] = useState(false)
  const [activeUserCreatedAt, setActiveUserCreatedAt] = useState<string | undefined>(undefined)
  const [activeUserGlowingColor, setActiveUserGlowingColor] = useState<string | null>(null)
  const [callMinutes, setCallMinutes] = useState({ audio: 0, video: 0 })
  const [isInitiatingCall, setIsInitiatingCall] = useState(false)

  const activeIsOnline = Boolean(activeUserId && onlineUserIds.includes(activeUserId))

  useEffect(() => {
    if (!isOpen || !user?.id) return

    const loadMinutes = async () => {
      try {
        const { data, error } = await supabase.rpc('get_call_balances', {
          p_user_id: user.id,
        })

        if (error) throw error

        setCallMinutes({
          audio: data?.audio_minutes || 0,
          video: data?.video_minutes || 0,
        })
      } catch (err) {
        console.error('Error loading call minutes:', err)
      }
    }

    void loadMinutes()
  }, [isOpen, user?.id])

  const initiateCall = async (callType: 'audio' | 'video') => {
    if (!user?.id || !activeUserId || isInitiatingCall) return

    const requiredMinutes = callType === 'audio' ? 1 : 2
    const hasMinutes =
      callType === 'audio'
        ? callMinutes.audio >= requiredMinutes
        : callMinutes.video >= requiredMinutes

    if (!hasMinutes) {
      toast.error(`You don't have enough ${callType} minutes. Please purchase a package.`)
      return
    }

    setIsInitiatingCall(true)

    try {
      const roomId = crypto.randomUUID()

      const { error: roomError } = await supabase.from('call_rooms').insert({
        id: roomId,
        caller_id: user.id,
        receiver_id: activeUserId,
        type: callType,
        status: 'pending',
      })

      if (roomError) throw roomError

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: activeUserId,
        type: 'call',
        title: 'Incoming Call',
        message: `${profile?.username || 'Someone'} is calling you`,
        metadata: {
          caller_id: user.id,
          caller_username: profile?.username,
          caller_avatar: profile?.avatar_url,
          call_type: callType,
          room_id: roomId,
        },
      })

      if (notifError) throw notifError

      navigate(`/call/${roomId}/${callType}/${activeUserId}`)
      closeChatBubble()
    } catch (err) {
      console.error('Error initiating call:', err)
      toast.error('Failed to start call. Please try again.')
    } finally {
      setIsInitiatingCall(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setLoading(false)
      setActualConversationId(null)
      setIsOpsConversation(false)
      setActiveUserCreatedAt(undefined)
      setActiveUserGlowingColor(null)
    }
  }, [isOpen])

  const handleLocalTyping = (_typing: boolean) => {}

  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
  }, [])

  useEffect(() => {
    if (!isOpen || !user?.id || !activeUserId) return

    let mounted = true

    const initChat = async () => {
      if (activeUserId === OFFICER_GROUP_CONVERSATION_ID) {
        setIsOpsConversation(true)
        setActualConversationId(OFFICER_GROUP_CONVERSATION_ID)
        return
      }

      setIsOpsConversation(false)

      const { data: userData } = await supabase
        .from('user_profiles')
        .select('created_at, glowing_username_color')
        .eq('id', activeUserId)
        .maybeSingle()

      if (mounted && userData) {
        setActiveUserCreatedAt(userData.created_at)
        setActiveUserGlowingColor(userData.glowing_username_color)
      }

      const { data: foundConvId } = await supabase.rpc('find_shared_conversation', {
        p_user_id: user.id,
        p_other_user_id: activeUserId,
      })

      let targetConvId: string | null = foundConvId || null

      if (!targetConvId) {
        try {
          const newConv = await createConversation([activeUserId])
          targetConvId = newConv.id
        } catch (err) {
          console.error('Failed to create conversation', err)
          toast.error('Failed to start chat')
          return
        }
      }

      if (mounted) setActualConversationId(targetConvId)
    }

    void initChat()

    return () => {
      mounted = false
    }
  }, [isOpen, activeUserId, user?.id])

  useEffect(() => {
    if (!actualConversationId || !isOpen) return

    let mounted = true

    const loadMessages = async () => {
      setLoading(true)

      try {
        const rows = await getConversationMessages(actualConversationId, { limit: 5000 })
        if (!mounted) return

        if (!rows || rows.length === 0) {
          setMessages([])
          return
        }

        const senderIds = Array.from(new Set(rows.map((m) => m.sender_id)))

        const { data: senders } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, rgb_username_expires_at, glowing_username_color, created_at')
          .in('id', senderIds)

        const senderMap: Record<string, any> = {}
        senders?.forEach((sender) => {
          senderMap[sender.id] = sender
        })

        const mapped = rows
          .map((message) => ({
            id: message.id,
            conversation_id: message.conversation_id,
            sender_id: message.sender_id,
            content: message.body,
            created_at: message.created_at,
            read_at: (message as any).read_at ?? null,
            sender_username: senderMap[message.sender_id]?.username,
            sender_avatar_url: senderMap[message.sender_id]?.avatar_url,
            sender_rgb_expires_at: senderMap[message.sender_id]?.rgb_username_expires_at,
            sender_glowing_username_color: senderMap[message.sender_id]?.glowing_username_color,
            sender_created_at: senderMap[message.sender_id]?.created_at,
          }))
          .reverse()

        setMessages(mapped)
        await markConversationRead(actualConversationId)
        window.setTimeout(scrollToBottom, 100)
      } catch (error) {
        console.error('Error loading messages:', error)
        setMessages([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadMessages()

    return () => {
      mounted = false
    }
  }, [actualConversationId, isOpen, scrollToBottom])

  useEffect(() => {
    if (!actualConversationId || !profile?.id || !isOpen) return

    const channel = supabase
      .channel(`tcps:${actualConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${actualConversationId}`,
        },
        async (payload) => {
          const newMsgRaw = payload.new

          let senderInfo = {
            username: 'Unknown',
            avatar_url: null,
            rgb_username_expires_at: null,
            glowing_username_color: null,
          }

          if (newMsgRaw.sender_id === user?.id) {
            senderInfo = {
              username: profile?.username || 'You',
              avatar_url: profile?.avatar_url || null,
              rgb_username_expires_at: profile?.rgb_username_expires_at || null,
              glowing_username_color: profile?.glowing_username_color || null,
            }
          } else if (newMsgRaw.sender_id === activeUserId) {
            senderInfo = {
              username: activeUsername || 'Unknown',
              avatar_url: activeUserAvatar || null,
              rgb_username_expires_at: null,
              glowing_username_color: activeUserGlowingColor || null,
            }
          } else {
            const { data } = await supabase
              .from('user_profiles')
              .select('username,avatar_url,rgb_username_expires_at,glowing_username_color,created_at')
              .eq('id', newMsgRaw.sender_id)
              .maybeSingle()

            if (data) senderInfo = data as any
          }

          const newMsg: Message = {
            id: newMsgRaw.id,
            conversation_id: newMsgRaw.conversation_id,
            sender_id: newMsgRaw.sender_id,
            content: newMsgRaw.body,
            created_at: newMsgRaw.created_at,
            read_at: newMsgRaw.read_at,
            sender_username: senderInfo.username,
            sender_avatar_url: senderInfo.avatar_url,
            sender_rgb_expires_at: senderInfo.rgb_username_expires_at,
            sender_glowing_username_color: (senderInfo as any).glowing_username_color,
          }

          setMessages((prev) => {
            const withoutPending = prev.filter((msg) => {
              if (!msg.isPending) return true
              return !(msg.content === newMsg.content && msg.sender_id === newMsg.sender_id)
            })

            return [...withoutPending, newMsg]
          })

          if (newMsgRaw.sender_id !== user?.id) {
            if (audioRef.current) {
              audioRef.current.src = '/sounds/pop.mp3'
              audioRef.current.play().catch((err) => console.log('Audio play blocked:', err))
            }

            void markConversationRead(actualConversationId)
          }

          window.setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [
    actualConversationId,
    profile?.id,
    profile?.username,
    profile?.avatar_url,
    profile?.rgb_username_expires_at,
    profile?.glowing_username_color,
    isOpen,
    user?.id,
    activeUserId,
    activeUsername,
    activeUserAvatar,
    activeUserGlowingColor,
    scrollToBottom,
  ])

  useEffect(() => {
    if (!actualConversationId || !isOpen) return

    const pollReadStatus = async () => {
      try {
        const { data } = await supabase
          .from('conversation_messages')
          .select('id, read_at')
          .eq('conversation_id', actualConversationId)
          .neq('sender_id', user?.id || '')
          .not('read_at', 'is', null)
          .limit(100)

        if (!data) return

        setMessages((prev) => {
          const readMap = new Map(data.map((message) => [message.id, message.read_at]))
          let changed = false

          const updated = prev.map((message) => {
            const newReadAt = readMap.get(message.id)

            if (newReadAt && message.read_at !== newReadAt) {
              changed = true
              return { ...message, read_at: newReadAt }
            }

            return message
          })

          return changed ? updated : prev
        })
      } catch {
        // silent fail
      }
    }

    pollIntervalRef.current = setInterval(pollReadStatus, 5000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [actualConversationId, isOpen, user?.id])

  const handleLocalNewMessage = (newMsg: any) => {
    const pendingMsg: Message = {
      id: newMsg.id || `temp-${Date.now()}`,
      conversation_id: newMsg.conversation_id || actualConversationId || '',
      sender_id: newMsg.sender_id || user?.id || '',
      content: newMsg.content || newMsg.body,
      created_at: newMsg.created_at || new Date().toISOString(),
      read_at: newMsg.read_at ?? null,
      sender_username: newMsg.sender_username || profile?.username,
      sender_avatar_url: newMsg.sender_avatar_url || profile?.avatar_url,
      sender_rgb_expires_at: newMsg.sender_rgb_expires_at || profile?.rgb_username_expires_at,
      sender_glowing_username_color: newMsg.sender_glowing_username_color || profile?.glowing_username_color,
      isPending: Boolean(newMsg.isPending),
    }

    setMessages((prev) => {
      if (!pendingMsg.isPending) {
        const withoutPending = prev.filter((msg) => {
          if (msg.id === pendingMsg.id) return false
          if (!msg.isPending) return true
          return !(msg.content === pendingMsg.content && msg.sender_id === pendingMsg.sender_id)
        })
        return [...withoutPending, pendingMsg]
      }

      return [...prev, pendingMsg]
    })
    scrollToBottom()
  }

  if (!isOpen) return null

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleMinimize}
          className="group relative flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/30 bg-slate-950/85 shadow-[0_0_34px_rgba(34,211,238,0.28)] backdrop-blur-2xl transition hover:scale-105 hover:border-fuchsia-300/40"
          title="Open chat"
        >
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.2),transparent_45%)]" />

          {isOpsConversation ? (
            <Shield className="relative h-7 w-7 text-cyan-200" />
          ) : (
            <img
              src={activeUserAvatar || `https://ui-avatars.com/api/?name=${activeUsername}&background=020617&color=67e8f9`}
              alt={activeUsername || ''}
              className="relative h-11 w-11 rounded-2xl border border-cyan-300/30 object-cover"
            />
          )}

          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-slate-950',
              activeIsOnline ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]' : 'bg-slate-500'
            )}
          />
        </button>

        <button
          onClick={closeChatBubble}
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-red-300/30 bg-red-500/20 text-red-100 shadow-lg backdrop-blur-xl transition hover:bg-red-500/35"
          title="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-3 z-50 flex h-[560px] w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-t-[2rem] border border-cyan-300/20 bg-slate-950/90 text-white shadow-[0_0_55px_rgba(34,211,238,0.22)] backdrop-blur-2xl animate-in slide-in-from-bottom-10 duration-200">
      <audio ref={audioRef} className="hidden" />

      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.16),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:34px_34px] opacity-15" />

      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-cyan-300/15 bg-slate-950/85 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            {isOpsConversation ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
                <Shield className="h-6 w-6 text-cyan-200" />
              </div>
            ) : (
              <>
                <img
                  src={activeUserAvatar || `https://ui-avatars.com/api/?name=${activeUsername}&background=020617&color=67e8f9`}
                  alt={activeUsername || ''}
                  className="h-11 w-11 rounded-2xl border border-cyan-300/25 object-cover shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                />
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950',
                    activeIsOnline ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]' : 'bg-slate-500'
                  )}
                />
              </>
            )}
          </div>

          <div className="min-w-0">
            {isOpsConversation ? (
              <>
                <div className="flex items-center gap-1.5 text-sm font-black text-white">
                  <Shield className="h-3.5 w-3.5 text-cyan-300" />
                  Officer Operations
                </div>
                <div className="text-[11px] font-semibold text-cyan-300/75">
                  Secure officer group chat
                </div>
              </>
            ) : (
              <>
                {activeUsername && (
                  <UserNameWithAge
                    user={{
                      username: activeUsername,
                      created_at: activeUserCreatedAt,
                      glowing_username_color: activeUserGlowingColor || undefined,
                    }}
                    className="truncate text-sm font-black text-white transition hover:text-cyan-200"
                  />
                )}

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      activeIsOnline ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'
                    )}
                  />
                  <span className={activeIsOnline ? 'text-emerald-300' : 'text-slate-500'}>
                    {activeIsOnline ? 'Online now' : 'Offline'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isOpsConversation && activeUserId && (
            <>
              <button
                onClick={() => initiateCall('audio')}
                disabled={isInitiatingCall}
                className="rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-2 text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-45"
                title={`Audio call (${callMinutes.audio} min available)`}
              >
                <Phone className="h-4 w-4" />
              </button>

              <button
                onClick={() => initiateCall('video')}
                disabled={isInitiatingCall}
                className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-2 text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-45"
                title={`Video call (${callMinutes.video} min available)`}
              >
                <Video className="h-4 w-4" />
              </button>
            </>
          )}

          <button
            onClick={toggleMinimize}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            onClick={closeChatBubble}
            className="rounded-xl border border-red-300/20 bg-red-500/10 p-2 text-red-200 transition hover:bg-red-500/20"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isOpsConversation && (
        <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/55 px-4 py-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200/80">
            <MessageCircle className="h-3.5 w-3.5" />
            TCPS Chat
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>Audio: {callMinutes.audio}m</span>
            <span className="text-slate-700">•</span>
            <span>Video: {callMinutes.video}m</span>
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="relative z-10 flex-1 space-y-3 overflow-y-auto bg-slate-950/35 p-4 no-scrollbar"
      >
        {loading ? (
          <div className="flex h-full min-h-[260px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200/70">
                Loading chat
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[260px] items-center justify-center">
            <div className="max-w-[230px] text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/15 bg-cyan-400/5">
                {isOpsConversation ? (
                  <Shield className="h-8 w-8 text-cyan-200/70" />
                ) : (
                  <Sparkles className="h-8 w-8 text-cyan-200/70" />
                )}
              </div>

              <p className="text-sm font-black text-white">
                {isOpsConversation ? 'Officer chat is ready' : `Start a conversation`}
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {isOpsConversation
                  ? 'Use this space for officer coordination and operations.'
                  : `Send a TCPS message to ${activeUsername || 'this user'}.`}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id

            return (
              <div key={msg.id} className={cn('flex w-full', isMe ? 'justify-end' : 'justify-start')}>
                <div className={cn('flex max-w-[88%] gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                  <img
                    src={
                      isMe
                        ? profile?.avatar_url ||
                          `https://ui-avatars.com/api/?name=${profile?.username}&background=020617&color=67e8f9`
                        : msg.sender_avatar_url ||
                          `https://ui-avatars.com/api/?name=${msg.sender_username}&background=020617&color=67e8f9`
                    }
                    alt={isMe ? 'You' : msg.sender_username || 'User'}
                    className={cn(
                      'h-8 w-8 shrink-0 rounded-2xl border object-cover',
                      isMe ? 'border-cyan-300/25' : 'border-fuchsia-300/20',
                      msg.isPending && 'opacity-50'
                    )}
                  />

                  <div className={cn('flex min-w-0 flex-col', isMe ? 'items-end' : 'items-start')}>
                    <div className="mb-1 flex items-center gap-2">
                      {!isMe && msg.sender_username && (
                        <UserNameWithAge
                          user={{
                            username: msg.sender_username,
                            id: msg.sender_id,
                            rgb_username_expires_at: msg.sender_rgb_expires_at || undefined,
                            glowing_username_color:
                              (msg as any).sender_glowing_username_color || undefined,
                            created_at: msg.sender_created_at,
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-cyan-200"
                        />
                      )}

                      {isMe && <span className="text-xs font-black text-cyan-300">You</span>}

                      <span className="text-[10px] text-slate-600">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div
                      className={cn(
                        'break-words rounded-2xl border px-3 py-2.5 text-sm leading-relaxed shadow-lg',
                        isMe
                          ? 'rounded-tr-md border-cyan-300/20 bg-cyan-400/15 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.08)]'
                          : 'rounded-tl-md border-fuchsia-300/15 bg-white/7 text-slate-200',
                        msg.isPending && 'opacity-70'
                      )}
                    >
                      {msg.content}
                    </div>

                    {isMe && (
                      <div className="mt-1 flex items-center gap-1">
                        {msg.isPending ? (
                          <div className="flex items-center gap-1" title="Sending...">
                            <Clock className="h-3 w-3 animate-pulse text-slate-500" />
                            <span className="text-[10px] text-slate-500">sending</span>
                          </div>
                        ) : msg.read_at ? (
                          <div
                            className="flex items-center gap-0.5"
                            title={`Read at ${new Date(msg.read_at).toLocaleTimeString()}`}
                          >
                            <CheckCheck className="h-3 w-3 text-cyan-300" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5" title="Delivered">
                            <CheckCheck className="h-3 w-3 text-slate-500" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {isTyping && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-xs text-slate-400">
            <div className="flex gap-1">
              <span className="animate-bounce delay-0">.</span>
              <span className="animate-bounce delay-100">.</span>
              <span className="animate-bounce delay-200">.</span>
            </div>
            <span>{activeUsername} is typing</span>
          </div>
        )}
      </div>

      <div className="relative z-10 shrink-0 border-t border-cyan-300/15 bg-slate-950/85 p-3">
        {actualConversationId && activeUserId && (
          <MessageInput
            conversationId={actualConversationId}
            otherUserId={activeUserId}
            onMessageSent={scrollToBottom}
            onNewMessage={handleLocalNewMessage}
            onTyping={handleLocalTyping}
          />
        )}
      </div>
    </div>
  )
}
