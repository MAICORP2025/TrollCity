import React, { useState } from 'react'
import { Pin, Send } from 'lucide-react'
import { useOrganizationMessages } from '@/hooks/useOrganizationMessages'
import type { OrganizationRecord } from '@/hooks/useOrganizations'

export default function OrganizationMessages({ organization }: { organization: OrganizationRecord }) {
  const { messages, loading, sendMessage } = useOrganizationMessages(organization.id)
  const [content, setContent] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [pinned, setPinned] = useState(false)

  const submit = async () => {
    const ok = await sendMessage(content, urgent, pinned)
    if (ok) {
      setContent('')
      setUrgent(false)
      setPinned(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-purple-500/20 bg-[#14101f]">
      <div className="border-b border-purple-500/20 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Messages</h2>
        <p className="text-xs text-zinc-400">Direct admin and organization staff communication.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading && <div className="text-sm text-zinc-400">Loading messages...</div>}
        {!loading && messages.length === 0 && <div className="text-sm text-zinc-500">No messages yet.</div>}
        {messages.map((message) => (
          <div key={message.id} className={`rounded-lg border p-3 ${message.is_urgent ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-black/20'}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span>{new Date(message.created_at).toLocaleString()}</span>
              <span className="flex items-center gap-2">
                {message.pinned && <Pin className="h-3.5 w-3.5 text-purple-300" />}
                {message.is_urgent && <span className="text-amber-300">Urgent</span>}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-100">{message.content}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-purple-500/20 p-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={`Message ${organization.name}...`}
          className="h-20 w-full resize-none rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-zinc-300">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
              Urgent
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
              Pinned
            </label>
          </div>
          <button onClick={submit} disabled={!content.trim()} className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
