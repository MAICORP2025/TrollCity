import React from 'react'
import { Building2, Mail, Users, Upload, MessageSquare, Ban, RotateCcw, Trash2 } from 'lucide-react'
import type { OrganizationRecord, OrganizationStatus } from '@/hooks/useOrganizations'

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  onboarding: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  suspended: 'bg-red-500/15 text-red-300 border-red-400/30',
  dropped: 'bg-zinc-500/15 text-zinc-300 border-zinc-400/30',
}

interface Props {
  organization: OrganizationRecord
  memberCount?: number
  selected?: boolean
  onOpen: () => void
  onQuickTab?: (tab: string) => void
  onStatus: (status: OrganizationStatus) => void
}

export default function OrganizationCard({ organization, memberCount = 0, selected, onOpen, onQuickTab, onStatus }: Props) {
  const status = organization.status || 'onboarding'
  return (
    <div className={`rounded-lg border p-4 bg-[#14101f] ${selected ? 'border-purple-400' : 'border-purple-500/20'}`}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-300" />
            <h3 className="truncate text-base font-semibold text-white">{organization.name}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className={`rounded-full border px-2 py-0.5 capitalize ${statusClasses[status] || statusClasses.onboarding}`}>
              {status}
            </span>
            <span>{organization.org_type || 'program'}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {memberCount} staff
            </span>
          </div>
        </button>
      </div>

      <div className="mt-3 space-y-1 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-zinc-500" />
          <span className="truncate">{organization.primary_contact_email || organization.email || 'No email'}</span>
        </div>
        <p className="line-clamp-2 text-zinc-500">{organization.description || 'No description yet.'}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <button onClick={() => onQuickTab?.('messages')} className="flex items-center justify-center gap-1.5 rounded-md border border-purple-500/20 px-2 py-2 text-purple-200 hover:bg-purple-500/10">
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </button>
        <button onClick={() => onQuickTab?.('files')} className="flex items-center justify-center gap-1.5 rounded-md border border-purple-500/20 px-2 py-2 text-purple-200 hover:bg-purple-500/10">
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
        {status === 'suspended' || status === 'dropped' ? (
          <button onClick={() => onStatus('active')} className="flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 px-2 py-2 text-emerald-300 hover:bg-emerald-500/10">
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </button>
        ) : (
          <button onClick={() => onStatus('suspended')} className="flex items-center justify-center gap-1.5 rounded-md border border-amber-500/30 px-2 py-2 text-amber-300 hover:bg-amber-500/10">
            <Ban className="h-3.5 w-3.5" />
            Suspend
          </button>
        )}
        {status !== 'dropped' && (
          <button onClick={() => onStatus('dropped')} className="flex items-center justify-center gap-1.5 rounded-md border border-red-500/30 px-2 py-2 text-red-300 hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" />
            Drop
          </button>
        )}
      </div>
    </div>
  )
}
