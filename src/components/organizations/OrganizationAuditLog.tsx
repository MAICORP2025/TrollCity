import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { OrganizationRecord } from '@/hooks/useOrganizations'

interface AuditRow {
  id: string
  action: string
  actor_id: string | null
  target_type: string | null
  metadata: any
  created_at: string
}

export default function OrganizationAuditLog({ organization }: { organization: OrganizationRecord }) {
  const [rows, setRows] = useState<AuditRow[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('organization_audit_logs')
        .select('*')
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(100)
      setRows((data || []) as AuditRow[])
    }
    void load()
  }, [organization.id])

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-purple-500/20 bg-[#14101f] p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck className="h-4 w-4 text-purple-300" />
        Audit Log
      </h2>
      <p className="mb-4 text-xs text-zinc-400">Organization activity and admin actions.</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-white">{row.action.replace(/_/g, ' ')}</span>
              <span className="text-xs text-zinc-500">{new Date(row.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {row.target_type || 'organization'} • {row.actor_id || 'system'}
            </div>
            {row.metadata && Object.keys(row.metadata).length > 0 && (
              <pre className="mt-2 max-h-24 overflow-auto rounded bg-black/30 p-2 text-xs text-zinc-400">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-zinc-500">No audit activity yet.</div>}
      </div>
    </div>
  )
}
