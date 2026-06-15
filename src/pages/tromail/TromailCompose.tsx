import React, { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { X, Send, Users, ChevronDown, Paperclip, FileText, Sheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { listUserOfficeFiles, shareOfficeFilesWithUsers } from '@/services/officeService'
import type { OfficeFileListItem } from '@/types/office'

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
  const [showOfficePicker, setShowOfficePicker] = useState(false)
  const [officeFiles, setOfficeFiles] = useState<OfficeFileListItem[]>([])
  const [selectedOfficeFiles, setSelectedOfficeFiles] = useState<OfficeFileListItem[]>([])
  const [isLoadingOfficeFiles, setIsLoadingOfficeFiles] = useState(false)

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

  React.useEffect(() => {
    if (!user || !showOfficePicker) return

    setIsLoadingOfficeFiles(true)
    listUserOfficeFiles(user.id)
      .then(setOfficeFiles)
      .catch(() => setOfficeFiles([]))
      .finally(() => setIsLoadingOfficeFiles(false))
  }, [showOfficePicker, user])

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

      if (selectedOfficeFiles.length > 0) {
        await shareOfficeFilesWithUsers({
          files: selectedOfficeFiles.map((file) => ({
            file_id: file.id,
            file_type: file.file_type,
            owner_id: file.owner_id,
            is_admin_document: file.is_admin_document,
          })),
          sharedWithUserIds: recipientUsers.map((r) => r.user_id),
          permissionLevel: 'viewer',
        })
      }

      toast.success('Message sent!')
      setSubject('')
      setBody('')
      setSelectedRecipients([])
      setSelectedOfficeFiles([])
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

          <div>
            <label className="text-xs font-medium uppercase text-gray-400">Office Attachments</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {selectedOfficeFiles.map((file) => (
                <span key={file.id} className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                  {file.file_type === 'document' ? <FileText className="h-3 w-3" /> : <Sheet className="h-3 w-3" />}
                  {file.title}
                  <button type="button" onClick={() => setSelectedOfficeFiles(selectedOfficeFiles.filter((item) => item.id !== file.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowOfficePicker(true)} className="h-8 border border-cyan-500/20 text-cyan-200">
                <Paperclip className="mr-1 h-4 w-4" /> Attach Office File
              </Button>
            </div>
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

          {showOfficePicker && (
            <div className="rounded-xl border border-cyan-500/20 bg-slate-800 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold">Choose Office File</h3>
                <button type="button" onClick={() => setShowOfficePicker(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {isLoadingOfficeFiles ? (
                <p className="py-6 text-center text-sm text-slate-400">Loading Office files...</p>
              ) : officeFiles.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No Office files found.</p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {officeFiles.map((file) => {
                    const checked = selectedOfficeFiles.some((item) => item.id === file.id)
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedOfficeFiles(checked ? selectedOfficeFiles.filter((item) => item.id !== file.id) : [...selectedOfficeFiles, file])}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${checked ? 'border-cyan-400/40 bg-cyan-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                      >
                        <span>
                          <span className="mr-2">{file.file_type === 'document' ? <FileText className="inline h-4 w-4 text-cyan-300" /> : <Sheet className="inline h-4 w-4 text-purple-300" />}</span>
                          <span className="text-sm text-white">{file.title}</span>
                        </span>
                        <span className={`h-4 w-4 rounded border ${checked ? 'border-cyan-300 bg-cyan-500' : 'border-slate-500'}`} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </form>
      </motion.div>
    </div>
  )
}