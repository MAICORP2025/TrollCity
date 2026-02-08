import React, { useState } from 'react'
import { AlertTriangle, Send } from 'lucide-react'

interface BugReportFormProps {
  onSubmit: (data: { type: string; severity: string; description: string }) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export default function BugReportForm({ onSubmit, onCancel, isSubmitting }: BugReportFormProps) {
  const [type, setType] = useState('bug')
  const [severity, setSeverity] = useState('medium')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    onSubmit({ type, severity, description })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full p-4 space-y-4">
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200 mb-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-xs">
          Bug Mode pages <strong>Admin</strong> directly. Use only for critical issues, exploits, or failures.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400">Issue Type</label>
        <select 
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-red-500 outline-none"
        >
          <option value="bug">Bug</option>
          <option value="exploit">Exploit</option>
          <option value="live_failure">Live Failure</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400">Severity</label>
        <select 
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-red-500 outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="space-y-1.5 flex-1">
        <label className="text-xs font-semibold text-slate-400">Description</label>
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          className="w-full h-32 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-red-500 outline-none resize-none"
          required
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : (
            <>
              <Send className="w-4 h-4" />
              Page Admin
            </>
          )}
        </button>
      </div>
    </form>
  )
}
