import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { Send, Smile } from 'lucide-react'
import { supabase, sendConversationMessage, OFFICER_GROUP_CONVERSATION_ID, sendOfficerMessage } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { useAuthStore } from '../../../lib/store'
import { useJailMode } from '../../../hooks/useJailMode'
import { useChatBlockStatus } from '../../../hooks/useChatBlockStatus'
import { canMessageAdmin } from '../../../lib/perkEffects'
import { chargeMessageCost } from '../../../lib/profileViewPayment'
import { emitEvent } from '../../../lib/events'
import { toast } from 'sonner'

interface MessageInputProps {
  conversationId: string | null
  otherUserId: string | null
  onMessageSent: () => void
  onNewMessage?: (msg: any) => void
  onTyping?: (isTyping: boolean) => void
  isGroup?: boolean
}

export default function MessageInput({ conversationId, otherUserId, onMessageSent, onNewMessage, onTyping, isGroup = false }: MessageInputProps) {
  const { user: _user, profile } = useAuthStore()
  const { isJailed } = useJailMode(profile?.id)
  const { userChatDisabled, chatDisabledRemainingMinutes } = useChatBlockStatus(profile?.id)
  const [isOtherUserAdmin, setIsOtherUserAdmin] = useState(false)
  const [message, setMessage] = useState('')
  const [sendingCount, setSendingCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!otherUserId) {
      setIsOtherUserAdmin(false)
      return
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(otherUserId)
    if (!isUuid) {
      setIsOtherUserAdmin(false)
      return
    }

    let cancelled = false

    const checkOtherUser = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', otherUserId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Error checking other user admin status', error)
        setIsOtherUserAdmin(false)
        return
      }

      setIsOtherUserAdmin(data?.role === 'admin' || data?.is_admin === true)
    }
    
    checkOtherUser()

    return () => {
      cancelled = true
    }
  }, [otherUserId])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase.channel(`tcps:${conversationId}`)
    channel.subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  const handleTyping = () => {
    // No-op: typing indicators removed to prevent per-keystroke broadcasts
  }

  const sendMessage = async () => {
    if (!message.trim() || !profile?.id) return
    if (!isGroup && !otherUserId) return

    // Chat disabled by moderation
    if (userChatDisabled) {
      toast.error(`Your chat is disabled.${chatDisabledRemainingMinutes ? ` Try again in ${chatDisabledRemainingMinutes} minute(s).` : ''}`)
      return
    }

    // Jail restriction: Inmates can only message admins (skip for group chats)
    if (!isGroup && isJailed && !isOtherUserAdmin) {
      toast.error('As an inmate, you can only message administrators.')
      return
    }

    if (!conversationId) {
      toast.error('Conversation not ready')
      return
    }

    const currentMessage = message.trim()
    setMessage('')
    setSendingCount((count) => count + 1)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      if (onTyping) onTyping(false)
    }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: profile.id,
        content: currentMessage,
        created_at: new Date().toISOString(),
        read_at: null,
        sender_username: profile.username,
        sender_avatar_url: profile.avatar_url,
        sender_rgb_expires_at: profile.rgb_username_expires_at,
        sender_glowing_username_color: profile.glowing_username_color,
        isPending: true,
      };

       if (onNewMessage) {
         onNewMessage(newMessage);
       }

       // Force immediate sidebar refresh for sender
       emitEvent('tcps_message_sent', profile.id, { conversationId })

    try {
      // Handle OPS group message
      if (conversationId === OFFICER_GROUP_CONVERSATION_ID) {
        const savedMessage = await sendOfficerMessage(currentMessage, 'normal')
        onNewMessage?.({ ...newMessage, ...savedMessage, content: (savedMessage as any)?.body || currentMessage, isPending: false })
        onMessageSent()
        inputRef.current?.focus()
        return
      }
      
      // Group chat: send message directly without payment check
      if (isGroup) {
        const savedMessage = await sendConversationMessage(conversationId, currentMessage)
        onNewMessage?.({ ...newMessage, ...savedMessage, content: savedMessage.body, isPending: false })
        onMessageSent()
        inputRef.current?.focus()
        return
      }
      
      // Regular DM message
      // Check if user needs to pay to message
      const { data: toUser, error: toUserError } = await supabase
        .from('user_profiles')
        .select('id, username, message_cost, role, is_troll_officer, is_troller')
        .eq('id', otherUserId)
        .maybeSingle()

      if (toUserError || !toUser) {
        toast.error('User not found')
        onNewMessage?.({ ...newMessage, content: `${currentMessage} (failed)`, isPending: false })
        return
      }

      const senderRole = profile.role
      const senderIsOfficer = profile.is_troll_officer || profile.is_officer
      const senderIsTroller = profile.is_troller
      const senderIsAdmin = senderRole === 'admin' || profile.is_admin
      const hasMessagePerk = await canMessageAdmin(profile.id)
      const canMessageFree = senderIsAdmin || senderIsOfficer || senderIsTroller || hasMessagePerk

      if (!canMessageFree && toUser.message_cost && toUser.message_cost > 0) {
        const { success, error: paymentError } = await chargeMessageCost(
          profile.id,
          toUser.id,
          toUser.message_cost
        )

        if (!success) {
          toast.error(paymentError || 'Payment required to message this user')
          onNewMessage?.({ ...newMessage, content: `${currentMessage} (failed)`, isPending: false })
          return
        }
      }
      
      const savedMessage = await sendConversationMessage(conversationId, currentMessage)
      onNewMessage?.({ ...newMessage, ...savedMessage, content: savedMessage.body, isPending: false })

      // Emit chat message event for troll system
      emitEvent('chat_message_sent', profile.id, {
        conversationId,
        recipientId: otherUserId,
        messageLength: currentMessage.length
      })

      // Notify the user via push/system notification
      await sendNotification(
        otherUserId,
        'message',
        `New message from ${profile.username}`,
        currentMessage.length > 50 ? currentMessage.substring(0, 50) + '...' : currentMessage,
        {
          conversation_id: conversationId,
          sender_id: profile.id
        }
      )

      if (onNewMessage) {
        // onNewMessage(newMsg) - disabled to prevent double rendering as subscription handles it
      }
      onMessageSent()
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to send message')
      // If failed, we might want to let the user know their proactive message didn't save
      onNewMessage?.({ ...newMessage, content: `${currentMessage} (failed)`, isPending: false })
    } finally {
      setSendingCount((count) => Math.max(0, count - 1))
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="p-4 bg-[#14141F] border-t border-purple-500/20">
      {isJailed && !isOtherUserAdmin ? (
        <div className="flex items-center justify-center p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <span>Communication restricted: You can only message admins while in jail.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button 
            className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => {
                if (userChatDisabled) return;
                setMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyDown}
              placeholder={userChatDisabled ? `Your chat is disabled${chatDisabledRemainingMinutes ? ` - try again in ${chatDisabledRemainingMinutes} min` : ''}` : "Type a message..."}
              readOnly={userChatDisabled}
              className="w-full bg-[#0A0A14] border border-purple-500/30 rounded-full px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!message.trim() || userChatDisabled}
            className={`p-2 rounded-full transition-all ${(!message.trim() || userChatDisabled)
                ? 'text-gray-600 bg-gray-800/50 cursor-not-allowed'
                : 'text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20'
              }`}
            title={userChatDisabled ? (chatDisabledRemainingMinutes ? `Chat disabled - ${chatDisabledRemainingMinutes} min` : 'Chat disabled') : sendingCount > 0 ? `${sendingCount} sending` : 'Send'}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
