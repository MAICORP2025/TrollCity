import React, { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { X, Send, Star, Users, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface TromailRecipient {
  user_id: string
  email_address: string
  role: string
  display_name: string | null
  username: string
}

interface TromailComposeProps {
  onSent?: () => void
  onClose?: () => void
}

export default function TromailCompose({ onSent, onClose }: TromailComposeProps) {
  const { user, profile } = useAuthStore()
  const [recipients, setRecipients] = useState<TromailRecipient[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [isAdminEmail, setIsAdminEmail] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false)
  const [searchRecipient, setSearchRecipient] = useState('')

  // Load recipient directory
  React.useEffect(() => {
    if (!user) return

    supabase
      .from('tromail_accounts')
      .select('user_id, email_address, role, display_name')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          // Get usernames separately
          const userIds = data.map((r: any) => r.user_id)
          supabase
            .from('user_profiles')
            .select('id, username')
            .in('id', userIds)
            .then(({ data: profiles }) => {
              const withUsernames = data.map((r: any) => ({
                ...r,
                username: profiles?.find((p: any) => p.id === r.user_id)?.username || 'Unknown',
              }))
              setRecipients(withUsernames)
            })
        }
      })
  }, [user])

  const filteredRecipients = recipients.filter(
    (r) =>
      r.email_address.toLowerCase().includes(searchRecipient.toLowerCase()) ||
      (r.display_name?.toLowerCase() || '').includes(searchRecipient.toLowerCase()) ||
      r.username.toLowerCase().includes(searchRecipient.toLowerCase())
  )

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || selectedRecipients.length === 0 || !subject || !body) {
      toast.error('Please fill all fields and select recipients')
      return
    }

    setIsSending(true)
    try {
      const senderRole = profile?.role || profile?.troll_role || 'user'
      const { data: senderAccount } = await supabase
        .from('tromail_accounts')
        .select('email_address')
        .eq('user_id', user.id)
        .single()

      if (!senderAccount) {
        toast.error('Your Tromail account not found')
        return
      }

      const recipientUsers = recipients.filter((r) => selectedRecipients.includes(r.user_id))

      const { error } = await supabase.rpc('send_tromail_message', {
        p_sender_user_id: user.id,
        p_sender_role: senderRole,
        p_sender_tromail_address: senderAccount.email_address,
        p_subject: subject,
        p_body: body,
        p_is_admin_email: isAdminEmail && canSendAdminEmail(profile),
        p_is_important: isImportant,
        p_recipient_user_ids: recipientUsers.map((r) => r.user_id),
        p_recipient_roles: recipientUsers.map((r) => r.role),
      })

      if (error) throw error

      toast.success('Message sent!')
      setSubject('')
      setBody('')
      setSelectedRecipients([])
      if (onSent) onSent()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const canSendAdminEmail = (profile: any): boolean => {
    if (!profile) return false
    const role = profile.role || profile.troll_role
    return (
      profile?.is_admin ||
      role === 'admin' ||
      role === 'ceo' ||
      profile?.is_ceo ||
      role === 'admin_assistant' ||
      role === 'ceo_assistant'
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-xl border border-cyan-500/30 bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-cyan-500/20 p-4">
          <h2 className="text-lg font-bold">Compose Tromail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          {/* Recipients */}
          <div className="relative">
            <label className="text-xs font-medium uppercase text-gray-400">To</label>
            <div className="mt-1">
              <div
                className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-cyan-500/30 bg-slate-800 px-3 py-2"
                onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
              >
                <Users className="h-4 w-4 text-cyan-400" />
                <span className="flex-1 text-sm text-gray-300">
                  {selectedRecipients.length === 0
                    ? 'Select recipients...'
                    : `${selectedRecipients.length} selected`}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>

              {showRecipientDropdown && (
                <div className="absolute inset-x-0 top-full z-10 mt-2 max-h-60 overflow-y-auto rounded-lg border border-cyan-500/20 bg-slate-800 p-2">
                  <Input
                    value={searchRecipient}
                    onChange={(e) => setSearchRecipient(e.target.value)}
                    placeholder="Search recipients..."
                    className="mb-2 border-cyan-500/30 bg-slate-900 text-white"
                  />
                  {filteredRecipients.map((r) => (
                    <label
                      key={r.user_id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(r.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecipients([...selectedRecipients, r.user_id])
                          } else {
                            setSelectedRecipients(
                              selectedRecipients.filter((id) => id !== r.user_id)
                            )
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {r.role} — {r.display_name || r.username}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium uppercase text-gray-400">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject"
              className="mt-1 border-cyan-500/30 bg-slate-800 text-white"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-medium uppercase text-gray-400">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              rows={6}
              className="mt-1 border-cyan-500/30 bg-slate-800 text-white"
            />
          </div>

          {/* Options */}
          {canSendAdminEmail(profile) && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAdminEmail}
                onChange={(e) => setIsAdminEmail(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-300">Send as Admin Email</span>
            </label>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Mark as Important</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending} className="bg-cyan-600 hover:bg-cyan-500">
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}