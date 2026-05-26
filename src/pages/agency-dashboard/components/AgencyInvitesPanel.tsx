import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { supabase } from '../../../lib/supabase'
import {
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react'

type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired' | 'used' | string

type AgencyInvite = {
  id: string
  agency_id: string
  invited_user_id: string | null
  invited_by: string
  invite_code: string
  invite_type: string | null
  role_offered: string | null
  status: InviteStatus
  message: string | null
  max_uses: number | null
  used_count: number | null
  expires_at: string | null
  accepted_at: string | null
  declined_at: string | null
  revoked_at: string | null
  created_at: string | null
  updated_at: string | null
  details?: unknown
}

type AgencyInvitesPanelProps = {
  agencyId: string
  currentUserId?: string
  canManage: boolean
}

type CreateInviteForm = {
  invited_user_id: string
  role_offered: string
  message: string
  expires_at: string
}

const glassPanel =
  'rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl'

const softPanel = 'rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl'

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20'

const labelClass = 'text-xs font-black uppercase tracking-[0.16em] text-slate-400'

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50'

const softButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'

const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-black text-red-50 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50'

const roleOptions = [
  { value: 'creator', label: 'Creator' },
  { value: 'manager', label: 'Manager' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'member', label: 'Member' },
]

const getInviteStatusStyle = (status?: string | null) => {
  const normalized = String(status || 'pending').toLowerCase()

  if (['accepted', 'used'].includes(normalized)) {
    return {
      label: normalized === 'used' ? 'Used' : 'Accepted',
      icon: CheckCircle2,
      className: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    }
  }

  if (normalized === 'pending') {
    return {
      label: 'Pending',
      icon: Clock3,
      className: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
    }
  }

  if (['declined', 'revoked', 'expired'].includes(normalized)) {
    return {
      label: normalized.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      icon: XCircle,
      className: 'border-red-300/30 bg-red-500/10 text-red-100',
    }
  }

  return {
    label: normalized.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    icon: ShieldCheck,
    className: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
  }
}

const safeDate = (value?: string | null) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString()
}

const isExpired = (expiresAt?: string | null) => {
  if (!expiresAt) return false
  const expiry = new Date(expiresAt)
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()
}

const buildInviteUrl = (inviteCode: string) => {
  if (typeof window === 'undefined') return inviteCode
  return `${window.location.origin}/agency-invite/${inviteCode}`
}

export function AgencyInvitesPanel({ agencyId, currentUserId, canManage }: AgencyInvitesPanelProps) {
  const [invites, setInvites] = useState<AgencyInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [form, setForm] = useState<CreateInviteForm>({
    invited_user_id: '',
    role_offered: 'creator',
    message: '',
    expires_at: '',
  })

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'pending' && !isExpired(invite.expires_at)),
    [invites],
  )

  const completedInvites = useMemo(
    () => invites.filter((invite) => invite.status !== 'pending' || isExpired(invite.expires_at)),
    [invites],
  )

  const myPendingInvites = useMemo(
    () =>
      invites.filter(
        (invite) =>
          invite.status === 'pending' &&
          !isExpired(invite.expires_at) &&
          invite.invited_user_id &&
          invite.invited_user_id === currentUserId,
      ),
    [currentUserId, invites],
  )

  const loadInvites = useCallback(async () => {
    if (!agencyId) return

    try {
      setLoading(true)
      setNotice(null)

      const { data, error } = await supabase
        .from('agency_invites')
        .select(
          `
          id,
          agency_id,
          invited_user_id,
          invited_by,
          invite_code,
          invite_type,
          role_offered,
          status,
          message,
          max_uses,
          used_count,
          expires_at,
          accepted_at,
          declined_at,
          revoked_at,
          created_at,
          updated_at,
          details
        `,
        )
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setInvites((data || []) as AgencyInvite[])
    } catch (err: any) {
      console.error('[AgencyInvitesPanel] Failed to load invites', err)
      setNotice({
        type: 'error',
        message: err?.message || 'Could not load agency invites.',
      })
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  const createInvite = async () => {
    if (!canManage) {
      setNotice({ type: 'error', message: 'Only agency owners, leaders, or managers can create invites.' })
      return
    }

    if (!agencyId) {
      setNotice({ type: 'error', message: 'Missing agency id.' })
      return
    }

    try {
      setSaving(true)
      setNotice(null)

      const expiresAt = form.expires_at ? new Date(form.expires_at).toISOString() : null

      const { data, error } = await supabase.rpc('create_agency_invite', {
        p_agency_id: agencyId,
        p_invited_user_id: form.invited_user_id.trim() || null,
        p_role_offered: form.role_offered || 'creator',
        p_message: form.message.trim() || null,
        p_expires_at: expiresAt,
      })

      if (error) throw error

      setForm({
        invited_user_id: '',
        role_offered: 'creator',
        message: '',
        expires_at: '',
      })

      setNotice({
        type: 'success',
        message: `Invite created${data?.invite_code ? `: ${data.invite_code}` : '.'}`,
      })

      await loadInvites()
    } catch (err: any) {
      console.error('[AgencyInvitesPanel] Failed to create invite', err)
      setNotice({
        type: 'error',
        message: err?.message || 'Could not create agency invite.',
      })
    } finally {
      setSaving(false)
    }
  }

  const acceptInvite = async (invite: AgencyInvite) => {
    try {
      setSaving(true)
      setNotice(null)

      const { error } = await supabase.rpc('accept_agency_invite', {
        p_invite_code: invite.invite_code,
      })

      if (error) throw error

      setNotice({
        type: 'success',
        message: 'Invite accepted. You are now active in this agency.',
      })

      await loadInvites()
    } catch (err: any) {
      console.error('[AgencyInvitesPanel] Failed to accept invite', err)
      setNotice({
        type: 'error',
        message: err?.message || 'Could not accept invite.',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateInviteStatus = async (invite: AgencyInvite, status: 'declined' | 'revoked') => {
    try {
      setSaving(true)
      setNotice(null)

      const { error } = await supabase.rpc('update_agency_invite_status', {
        p_invite_id: invite.id,
        p_status: status,
      })

      if (error) throw error

      setNotice({
        type: 'success',
        message: status === 'declined' ? 'Invite declined.' : 'Invite revoked.',
      })

      await loadInvites()
    } catch (err: any) {
      console.error('[AgencyInvitesPanel] Failed to update invite status', err)
      setNotice({
        type: 'error',
        message: err?.message || `Could not ${status} invite.`,
      })
    } finally {
      setSaving(false)
    }
  }

  const copyInvite = async (invite: AgencyInvite, mode: 'code' | 'link') => {
    const text = mode === 'code' ? invite.invite_code : buildInviteUrl(invite.invite_code)

    try {
      setCopyingId(invite.id)
      await navigator.clipboard.writeText(text)
      setNotice({
        type: 'success',
        message: mode === 'code' ? 'Invite code copied.' : 'Invite link copied.',
      })
    } catch (err) {
      console.error('[AgencyInvitesPanel] Failed to copy invite', err)
      setNotice({
        type: 'error',
        message: 'Could not copy invite. Copy it manually instead.',
      })
    } finally {
      setCopyingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className={`${glassPanel} p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-100">
              <UserPlus className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Agency Invites</p>
              <h3 className="mt-1 text-xl font-black text-white">Invite creators, managers, recruiters, and members</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                Create tracked in-app invites. Accepted invites automatically activate agency membership through the backend RPC and write agency audit logs.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void loadInvites()}
            disabled={loading || saving}
            className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {notice && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                : 'border-red-400/30 bg-red-500/10 text-red-100'
            }`}
          >
            {notice.message}
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <InviteStat label="Pending Invites" value={pendingInvites.length} />
          <InviteStat label="Accepted / Used" value={invites.filter((invite) => ['accepted', 'used'].includes(invite.status)).length} />
          <InviteStat label="Needs Your Response" value={myPendingInvites.length} />
        </div>
      </section>

      {canManage && (
        <section className={`${glassPanel} p-5`}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-fuchsia-500/10 p-3 text-fuchsia-100">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Create Invite</p>
              <h3 className="text-lg font-black text-white">Send an in-app agency invite</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label className={labelClass}>Invited user id optional</label>
              <input
                value={form.invited_user_id}
                onChange={(event) => setForm((current) => ({ ...current, invited_user_id: event.target.value }))}
                className={`${inputClass} mt-2`}
                placeholder="Paste user id or leave blank for open invite code"
              />
              <p className="mt-2 text-xs text-slate-500">
                Leave blank to create an open invite code. Add a user id to lock the invite to one account.
              </p>
            </div>

            <div>
              <label className={labelClass}>Role offered</label>
              <select
                value={form.role_offered}
                onChange={(event) => setForm((current) => ({ ...current, role_offered: event.target.value }))}
                className={`${inputClass} mt-2`}
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Expires at optional</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))}
                className={`${inputClass} mt-2`}
              />
            </div>

            <div>
              <label className={labelClass}>Invite message</label>
              <input
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className={`${inputClass} mt-2`}
                placeholder="Join our agency and start building with us..."
              />
            </div>
          </div>

          <Button type="button" disabled={saving} onClick={() => void createInvite()} className={`${primaryButtonClass} mt-5`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Create Invite
          </Button>
        </section>
      )}

      {myPendingInvites.length > 0 && (
        <section className={`${glassPanel} p-5`}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Your Invites</p>
          <h3 className="mt-1 text-lg font-black text-white">You have agency invites waiting</h3>

          <div className="mt-4 space-y-3">
            {myPendingInvites.map((invite) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                currentUserId={currentUserId}
                canManage={canManage}
                saving={saving}
                copyingId={copyingId}
                onAccept={acceptInvite}
                onDecline={(item) => updateInviteStatus(item, 'declined')}
                onRevoke={(item) => updateInviteStatus(item, 'revoked')}
                onCopy={copyInvite}
              />
            ))}
          </div>
        </section>
      )}

      <section className={`${glassPanel} p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Pending</p>
            <h3 className="mt-1 text-lg font-black text-white">Open agency invites</h3>
          </div>
          <Badge variant="outline" className="w-fit border-amber-500/30 text-amber-200">
            {pendingInvites.length} pending
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <LoadingBlock label="Loading pending invites..." />
          ) : pendingInvites.length === 0 ? (
            <EmptyBlock label="No pending invites yet." helper={canManage ? 'Create an invite above to bring someone into this agency.' : 'No invites are waiting right now.'} />
          ) : (
            pendingInvites.map((invite) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                currentUserId={currentUserId}
                canManage={canManage}
                saving={saving}
                copyingId={copyingId}
                onAccept={acceptInvite}
                onDecline={(item) => updateInviteStatus(item, 'declined')}
                onRevoke={(item) => updateInviteStatus(item, 'revoked')}
                onCopy={copyInvite}
              />
            ))
          )}
        </div>
      </section>

      <section className={`${glassPanel} p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">History</p>
            <h3 className="mt-1 text-lg font-black text-white">Accepted, declined, revoked, and expired invites</h3>
          </div>
          <Badge variant="outline" className="w-fit border-white/10 text-slate-300">
            {completedInvites.length} records
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <LoadingBlock label="Loading invite history..." />
          ) : completedInvites.length === 0 ? (
            <EmptyBlock label="No invite history yet." helper="Invite history will appear here after users accept, decline, or invites expire." />
          ) : (
            completedInvites.map((invite) => (
              <InviteCard
                key={invite.id}
                invite={invite}
                currentUserId={currentUserId}
                canManage={canManage}
                saving={saving}
                copyingId={copyingId}
                onAccept={acceptInvite}
                onDecline={(item) => updateInviteStatus(item, 'declined')}
                onRevoke={(item) => updateInviteStatus(item, 'revoked')}
                onCopy={copyInvite}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function InviteCard({
  invite,
  currentUserId,
  canManage,
  saving,
  copyingId,
  onAccept,
  onDecline,
  onRevoke,
  onCopy,
}: {
  invite: AgencyInvite
  currentUserId?: string
  canManage: boolean
  saving: boolean
  copyingId: string | null
  onAccept: (invite: AgencyInvite) => Promise<void>
  onDecline: (invite: AgencyInvite) => Promise<void> | void
  onRevoke: (invite: AgencyInvite) => Promise<void> | void
  onCopy: (invite: AgencyInvite, mode: 'code' | 'link') => Promise<void>
}) {
  const status = getInviteStatusStyle(isExpired(invite.expires_at) && invite.status === 'pending' ? 'expired' : invite.status)
  const StatusIcon = status.icon
  const isPending = invite.status === 'pending' && !isExpired(invite.expires_at)
  const isMine = Boolean(invite.invited_user_id && invite.invited_user_id === currentUserId)
  const isOpenInvite = !invite.invited_user_id

  return (
    <div className={`${softPanel} p-4`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>

            <Badge variant="outline" className="border-cyan-500/30 text-cyan-200">
              {invite.role_offered || 'creator'}
            </Badge>

            {isOpenInvite && (
              <Badge variant="outline" className="border-fuchsia-500/30 text-fuchsia-200">
                Open invite
              </Badge>
            )}

            {isMine && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-200">
                Sent to you
              </Badge>
            )}
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <Detail label="Invite Code" value={invite.invite_code} />
            <Detail label="Invited User" value={invite.invited_user_id || 'Open invite code'} />
            <Detail label="Created" value={safeDate(invite.created_at)} />
            <Detail label="Expires" value={safeDate(invite.expires_at)} />
            <Detail label="Used" value={`${invite.used_count || 0} / ${invite.max_uses || 1}`} />
            <Detail label="Invite Type" value={invite.invite_type || 'member'} />
          </div>

          {invite.message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-200">
              {invite.message}
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[22rem]">
          <button type="button" disabled={copyingId === invite.id} onClick={() => void onCopy(invite, 'code')} className={softButtonClass}>
            {copyingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copy Code
          </button>

          <button type="button" disabled={copyingId === invite.id} onClick={() => void onCopy(invite, 'link')} className={softButtonClass}>
            {copyingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Copy Link
          </button>

          {isPending && (isMine || isOpenInvite) && (
            <button type="button" disabled={saving} onClick={() => void onAccept(invite)} className={primaryButtonClass}>
              <CheckCircle2 className="h-4 w-4" />
              Accept
            </button>
          )}

          {isPending && isMine && (
            <button type="button" disabled={saving} onClick={() => void onDecline(invite)} className={dangerButtonClass}>
              <XCircle className="h-4 w-4" />
              Decline
            </button>
          )}

          {isPending && canManage && (
            <button type="button" disabled={saving} onClick={() => void onRevoke(invite)} className={dangerButtonClass}>
              <XCircle className="h-4 w-4" />
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InviteStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={softPanel + ' p-4'}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-slate-100">{value}</p>
    </div>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">
      <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
      {label}
    </div>
  )
}

function EmptyBlock({ label, helper }: { label: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6">
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  )
}