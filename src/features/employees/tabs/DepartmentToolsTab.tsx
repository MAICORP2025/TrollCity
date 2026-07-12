import React, { Suspense } from 'react'
import { useAuthStore } from '../../../lib/store'
import { isTrollOfficer, isLead, isAssistant } from '../permissions'

const OfficerOWCDashboard = React.lazy(() => import('../../../pages/OfficerOWCDashboard'))
const OfficerModeration = React.lazy(() => import('../../../pages/OfficerModeration'))
const OfficerVote = React.lazy(() => import('../../../pages/OfficerVote'))

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </div>
  )
}

export default function DepartmentToolsTab({ profile }: { profile?: any; realProfile?: any }) {
  const { profile: p } = useAuthStore()
  const officer = isTrollOfficer(p) || isLead(p)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Role-specific tools. Access follows your permission set.</p>

      {officer && (
        <>
          <Frame title="Officer Work Credit (OWC)">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
              <OfficerOWCDashboard />
            </Suspense>
          </Frame>
          <Frame title="Moderation Tools">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
              <OfficerModeration />
            </Suspense>
          </Frame>
          <Frame title="Officer of the Week Vote">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
              <OfficerVote />
            </Suspense>
          </Frame>
        </>
      )}

      {isAssistant(p) && (
        <Frame title="Assistant Tools">
          <p className="text-sm text-slate-300">
            Use the Management tab for executive messages, documents, escalations, and the Assistant Workspace.
          </p>
        </Frame>
      )}

      {!officer && !isAssistant(p) && (
        <Frame title="Department Tools">
          <p className="text-sm text-slate-400">No department-specific tools are available for your role.</p>
        </Frame>
      )}
    </div>
  )
}
