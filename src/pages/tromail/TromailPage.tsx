import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
   Mail,
   Send,
   Inbox,
   Star,
   Calendar,
   Users,
   FileText,
   Trash2,
   Archive,
   Reply,
   Forward,
   MoreVertical,
   Plus,
   RefreshCw,
   Search,
   X,
   Bell,
   AlertCircle,
   Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createTromailAccount, getUserTromailAccount, canAccessTromail, canSendAdminEmail } from '@/lib/tromail'

type TromailTab = 'inbox' | 'sent' | 'important' | 'admin' | 'calendar' | 'meetings' | 'directory' | 'compose'

interface TromailMessage {
  id: string
  sender_user_id: string
  sender_role: string
  sender_tromail_address: string
  subject: string
  body: string
  is_admin_email: boolean
  is_important: boolean
  related_meeting_id: string | null
  created_at: string
  read_at?: string | null
  sender_username?: string
}

interface TromailAccountInfo {
  id: string
  user_id: string
  role: string
  display_name: string | null
  email_address: string
  is_active: boolean
}

export default function TromailPage() {
   const { user, profile } = useAuthStore()
   const navigate = useNavigate()
   const [activeTab, setActiveTab] = useState<TromailTab>('inbox')
  const [messages, setMessages] = useState<TromailMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasTromailAccount, setHasTromailAccount] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.full_name || profile?.username || '')
  const [tromailAddress, setTromailAddress] = useState('')

  // Compose state - support multiple recipients
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [isAdminEmail, setIsAdminEmail] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Check Tromail access
  useEffect(() => {
    if (user && profile && !canAccessTromail(profile)) {
      toast.error('Access denied. Tromail requires approved role.')
      window.location.href = '/'
      return
    }

    if (user && profile) {
      checkTromailAccount()
    }
  }, [user, profile])

  const checkTromailAccount = async () => {
    if (!user) return
    const account = await getUserTromailAccount(user.id)
    setHasTromailAccount(!!account)
  }

  const handleCreateAccount = async () => {
    if (!user || !profile) return

    const role = profile.role || profile.troll_role || 'user'
    const result = await createTromailAccount(user.id, role, displayName)

    if (result.success) {
      toast.success('Tromail account created!')
      setHasTromailAccount(true)
      setShowCreateModal(false)
      setTromailAddress(result.address || '')
    } else {
      toast.error(result.error || 'Failed to create account')
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile || recipients.length === 0 || !subject || !body) {
      toast.error('Please fill all fields and add recipients')
      return
    }

    setIsSending(true)
    try {
      const recipientAccounts = await Promise.all(
        recipients.map(async (addr) => {
          const { data } = await supabase
            .from('tromail_accounts')
            .select('user_id, role')
            .eq('email_address', addr)
            .single()
          return data
        })
      )

      const validRecipients = recipientAccounts.filter(Boolean) as { user_id: string; role: string }[]
      if (validRecipients.length === 0) {
        toast.error('No valid recipients found')
        return
      }

      const senderRole = profile.role || profile.troll_role || 'user'
      const { data: senderAccount } = await supabase
        .from('tromail_accounts')
        .select('email_address')
        .eq('user_id', user.id)
        .single()

      if (!senderAccount) {
        toast.error('Sender account not found')
        return
      }

      const { error } = await supabase.rpc('send_tromail_message', {
        p_sender_user_id: user.id,
        p_sender_role: senderRole,
        p_sender_tromail_address: senderAccount.email_address,
        p_subject: subject,
        p_body: body,
        p_is_admin_email: isAdminEmail,
        p_is_important: isImportant,
        p_recipient_user_ids: validRecipients.map(r => r.user_id),
        p_recipient_roles: validRecipients.map(r => r.role)
      })

      if (error) throw error

      toast.success('Message sent!')
      setSubject('')
      setBody('')
      setRecipients([])
      setIsImportant(false)
      setIsAdminEmail(false)
      setActiveTab('inbox')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  // Fetch messages based on active tab
  const fetchMessages = useCallback(async () => {
    if (!user || !hasTromailAccount) return

    setIsLoading(true)
    try {
      let result: any = []

      if (activeTab === 'inbox') {
        const { data } = await supabase.rpc('get_tromail_inbox', { p_user_id: user.id })
        result = data || []
      } else if (activeTab === 'sent') {
        const { data } = await supabase.rpc('get_tromail_sent', { p_user_id: user.id })
        result = data || []
      } else if (activeTab === 'important') {
        const { data } = await supabase.rpc('get_tromail_important', { p_user_id: user.id })
        result = data || []
      } else if (activeTab === 'admin') {
        const { data } = await supabase.rpc('get_tromail_admin', { p_user_id: user.id })
        result = data || []
      } else if (activeTab === 'directory') {
        const { data } = await supabase
          .from('tromail_accounts')
          .select('id, user_id, role, display_name, email_address, is_active')
          .eq('is_active', true)
          .order('role', { ascending: true })
        result = data || []
      }

      setMessages(result)
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      toast.error('Failed to load messages')
    } finally {
      setIsLoading(false)
    }
  }, [user, hasTromailAccount, activeTab])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // First-time setup modal
  if (!hasTromailAccount) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-xl border border-cyan-500/30 bg-slate-900 p-6"
        >
          <div className="mb-4 text-center">
            <Mail className="mx-auto mb-2 h-12 w-12 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Welcome to Tromail</h2>
            <p className="text-sm text-gray-400">Create your official Tromail address</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase text-gray-400">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name for Tromail"
                className="mt-1 border-cyan-500/30 bg-slate-800 text-white"
              />
            </div>

            <Button onClick={handleCreateAccount} className="w-full bg-cyan-600 hover:bg-cyan-500">
              Create Tromail Account
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-8 w-8 text-cyan-400" />
            <h1 className="text-2xl font-bold">Tromail</h1>
            <span className="text-xs text-cyan-300">{tromailAddress}</span>
          </div>
          <Button
            onClick={() => setActiveTab('compose')}
            className="bg-gradient-to-r from-cyan-600 to-purple-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-cyan-500/20 pb-4">
          {[
            { id: 'inbox', label: 'Inbox', icon: Inbox },
            { id: 'sent', label: 'Sent', icon: Send },
            { id: 'important', label: 'Important', icon: Star },
            { id: 'admin', label: 'Admin Emails', icon: Bell },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'meetings', label: 'Team Meetings', icon: Users },
            { id: 'directory', label: 'Role Directory', icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TromailTab)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Compose Form */}
        {activeTab === 'compose' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-6"
          >
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-gray-400">To</label>
                <div className="mt-1 flex flex-wrap gap-2 rounded-lg border border-cyan-500/30 bg-slate-900 p-2">
                  {recipients.map((r) => (
                    <span key={r} className="flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-1 text-xs">
                      {r}
                      <button
                        type="button"
                        onClick={() => setRecipients(recipients.filter(rp => rp !== r))}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && recipientInput.trim()) {
                        e.preventDefault()
                        if (!recipients.includes(recipientInput.trim())) {
                          setRecipients([...recipients, recipientInput.trim()])
                        }
                        setRecipientInput('')
                      }
                    }}
                    placeholder={recipients.length === 0 ? "recipient@tromail.trollcity (press Enter to add)" : ""}
                    className="flex-1 border-0 bg-transparent p-1 text-white placeholder-gray-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase text-gray-400">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message subject"
                  className="mt-1 border-cyan-500/30 bg-slate-900 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase text-gray-400">Message</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message..."
                  rows={6}
                  className="mt-1 border-cyan-500/30 bg-slate-900 text-white"
                />
              </div>

              {canSendAdminEmail(profile) && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isAdminEmail}
                    onChange={(e) => setIsAdminEmail(e.target.checked)}
                    className="rounded border-cyan-500/30"
                  />
                  <span className="text-sm text-gray-300">Admin Email</span>
                </label>
              )}

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isImportant}
                  onChange={(e) => setIsImportant(e.target.checked)}
                  className="rounded border-cyan-500/30"
                />
                <span className="text-sm text-gray-300">Mark as Important</span>
              </label>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSending} className="bg-cyan-600 hover:bg-cyan-500">
                  {isSending ? 'Sending...' : 'Send'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveTab('inbox')}
                  className="text-gray-400"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Messages List - for inbox, sent, important, admin tabs */}
        {['inbox', 'sent', 'important', 'admin'].includes(activeTab) && (
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-cyan-500/20 bg-slate-800/30 p-8 text-center">
                <Mail className="mx-auto mb-3 h-12 w-12 text-gray-600" />
                <p className="text-gray-400">No messages in {activeTab}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`rounded-lg border border-cyan-500/20 bg-slate-800/50 p-4 hover:bg-slate-800/70 ${
                    msg.is_important ? 'border-yellow-500/30 bg-yellow-500/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{msg.subject}</h3>
                        {msg.is_important && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                        {msg.is_admin_email && (
                          <Bell className="h-4 w-4 text-cyan-400" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        From: {msg.sender_role} — {msg.sender_username || msg.sender_tromail_address}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-300">{msg.body}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRecipients([msg.sender_tromail_address])
                            setSubject(`Re: ${msg.subject}`)
                            setBody(`\n\n-------- Original Message --------\nFrom: ${msg.sender_username || msg.sender_tromail_address}\n${msg.body}`)
                            setActiveTab('compose')
                          }}
                          className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-6 text-center">
              <Calendar className="mx-auto mb-3 h-12 w-12 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white mb-2">Tromail Calendar</h3>
              <p className="text-sm text-gray-400 mb-4">Schedule and view team meetings and official events.</p>
              <Button
                onClick={() => navigate('/admin/meetings')}
                className="bg-cyan-600 hover:bg-cyan-500"
              >
                <Video className="h-4 w-4 mr-2" />
                Go to Meeting Dashboard
              </Button>
            </div>
          </div>
        )}

        {/* Team Meetings Tab */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-6 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white mb-2">Team Meetings</h3>
              <p className="text-sm text-gray-400 mb-4">View and manage staff meetings through the Admin Meetings Dashboard.</p>
              <Button
                onClick={() => navigate('/admin/meetings')}
                className="bg-cyan-600 hover:bg-cyan-500"
              >
                <Video className="h-4 w-4 mr-2" />
                Open Meetings Dashboard
              </Button>
            </div>
          </div>
        )}

        {/* Directory Tab */}
        {activeTab === 'directory' && (
          <div className="space-y-3">
            {recipients.length > 0 && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setActiveTab('compose')}
                  className="bg-cyan-600 hover:bg-cyan-500"
                >
                  Send to {recipients.length} selected
                </Button>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-cyan-500/20 bg-slate-800/30 p-8 text-center">
                <Users className="mx-auto mb-3 h-12 w-12 text-gray-600" />
                <p className="text-gray-400">No users in directory</p>
              </div>
            ) : (
              messages.map((msg: any) => (
                <div key={msg.id} className="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={recipients.includes(msg.email_address)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRecipients([...recipients, msg.email_address])
                          } else {
                            setRecipients(recipients.filter(r => r !== msg.email_address))
                          }
                        }}
                        className="rounded"
                      />
                      <div>
                        <p className="font-semibold text-white">{msg.role}</p>
                        <p className="text-xs text-gray-400">{msg.email_address}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setRecipients([msg.email_address]); setActiveTab('compose'); }}
                      className="bg-cyan-600 hover:bg-cyan-500"
                    >
                      Message
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {/* Fallback for unhandled tabs */}
        {!['inbox', 'sent', 'important', 'admin', 'calendar', 'meetings', 'directory', 'compose'].includes(activeTab) && (
          <div className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-600" />
            <p className="text-gray-400">Tab not implemented: {activeTab}</p>
          </div>
        )}
      </div>
    </div>
  )
}