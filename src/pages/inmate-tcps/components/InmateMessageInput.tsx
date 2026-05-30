import { useState, KeyboardEvent, useRef } from 'react'
import { Send } from 'lucide-react'
import { supabase, sendConversationMessage, OFFICER_GROUP_CONVERSATION_ID } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { useAuthStore } from '../../../lib/store'
import { useJailMode } from '../../../hooks/useJailMode'
import { toast } from 'sonner'

interface InmateMessageInputProps {
  conversationId: string | null
  onMessageSent: () => void
}

export default function InmateMessageInput({ conversationId, onMessageSent }: InmateMessageInputProps) {
  const { user, profile } = useAuthStore()
  const { isJailed } = useJailMode(profile?.id)
  const [message, setMessage] = useState('')
  const [sendingCount, setSendingCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const sendMessage = async () => {
    if (!message.trim() || !profile?.id || !conversationId) return
    if (conversationId === OFFICER_GROUP_CONVERSATION_ID) return

    if (isJailed) {
      const { data: otherMember } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user?.id)
        .maybeSingle()

      if (otherMember?.user_id) {
        const { data: otherProfile } = await supabase
          .from('user_profiles')
          .select('role, is_admin')
          .eq('id', otherMember.user_id)
          .maybeSingle()

        const isOtherAdmin = otherProfile?.role === 'admin' || otherProfile?.is_admin === true
        if (!isOtherAdmin) {
          toast.error('As an inmate, you can only message administrators.')
          return
        }
      }
    }

    const currentMessage = message.trim()
    setMessage('')
    setSendingCount((count) => count + 1)

    try {
      const savedMessage = await sendConversationMessage(conversationId, currentMessage)

      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user?.id)

      if (members && members.length > 0) {
        for (const member of members) {
          await sendNotification(
            member.user_id,
            'message',
            `New message from ${profile.username}`,
            currentMessage.length > 50 ? currentMessage.substring(0, 50) + '...' : currentMessage,
            {
              conversation_id: conversationId,
              sender_id: profile.id,
            }
          ).catch(() => {})
        }
      }

      onMessageSent()
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to send message')
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
    <div className="border-t border-zinc-800 bg-zinc-950/80 p-4">
      {isJailed && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
          ⚠ Inmate mode — only admins can be messaged
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a monitored message..."
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-cyan-700"
        />
        <button
          onClick={sendMessage}
          disabled={!message.trim() || sendingCount > 0}
          className={`rounded-xl p-2.5 transition-all ${
            !message.trim() || sendingCount > 0
              ? 'cursor-not-allowed bg-zinc-800/50 text-zinc-700'
              : 'bg-cyan-700 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-900/30'
          }`}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
