import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Shield, CheckCircle2, XCircle, Clock, AlertTriangle, Eye, Ban, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

type ApplicationStatus = 'draft' | 'payment_pending' | 'payment_failed' | 'submitted' | 'under_review' | 'more_information_required' | 'approved' | 'denied' | 'revoked' | 'suspended' | 'expired'

interface ApplicationRow {
  id: string
  user_id: string
  legal_first_name: string
  legal_last_name: string
  date_of_birth: string
  email: string
  country: string
  state_province: string
  status: ApplicationStatus
  payment_status: string
  paypal_order_id?: string
  paypal_capture_id?: string
  payment_amount?: number
  payment_timestamp?: string
  reviewer_notes?: string
  denial_reason?: string
  created_at: string
  updated_at: string
  troll_city_username?: string
  id_front_url?: string | null
  id_back_url?: string | null
  selfie_url?: string | null
  xtrollz_role?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  payment_pending: 'bg-yellow-500/20 text-yellow-300',
  payment_failed: 'bg-red-500/20 text-red-300',
  submitted: 'bg-blue-500/20 text-blue-300',
  under_review: 'bg-purple-500/20 text-purple-300',
  more_information_required: 'bg-orange-500/20 text-orange-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  denied: 'bg-red-500/20 text-red-300',
  revoked: 'bg-red-500/20 text-red-300',
  suspended: 'bg-red-500/20 text-red-300',
  expired: 'bg-gray-500/20 text-gray-300',
}

export default function XtrollzAdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all')
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [denialReason, setDenialReason] = useState('')
  const [editDob, setEditDob] = useState('')
  const [editRole, setEditRole] = useState<'streamer' | 'viewer'>('streamer')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('xtrollz_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications((data || []) as ApplicationRow[])
    } catch (e) {
      console.warn('[XTrollzAdmin] load error:', e)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadApplications()
  }, [filter])

  const updateStatus = async (appId: string, status: ApplicationStatus, extra: Record<string, any> = {}) => {
    if (!user?.id) return
    setIsProcessing(true)

    try {
      const updatePayload: any = {
        status,
        reviewer_id: user.id,
        reviewer_notes: reviewNotes || null,
        denial_reason: status === 'denied' ? denialReason || null : null,
        last_status_change: new Date().toISOString(),
        xtrollz_role: editRole,
        ...(status === 'approved' ? { approval_timestamp: new Date().toISOString() } : {}),
        ...extra,
      }

      if (editDob && editDob !== selectedApp?.date_of_birth) {
        updatePayload.date_of_birth = editDob
      }

      const { error } = await supabase
        .from('xtrollz_applications')
        .update(updatePayload)
        .eq('id', appId)

      if (error) throw error

      if (status === 'approved' && selectedApp?.user_id) {
        await supabase
          .from('user_profiles')
          .update({ is_broadcaster: editRole === 'streamer' })
          .eq('id', selectedApp.user_id)
      }

      await supabase.from('xtrollz_moderation_actions').insert({
        user_id: selectedApp?.user_id,
        stream_id: null,
        action_type: `xtrollz_application_${status}`,
        reason: reviewNotes || `Application ${status}`,
        target_user_id: selectedApp?.user_id,
        moderator_id: user.id,
        moderator_role: 'admin',
        metadata: { application_id: appId, xtrollz_role: editRole, ...extra },
      })

      toast.success(`Application ${status}`)
      setSelectedApp(null)
      setReviewNotes('')
      setDenialReason('')
      setEditDob('')
      setEditRole('streamer')
      void loadApplications()
    } catch (e) {
      toast.error('Failed to update application')
      console.warn('[XTrollzAdmin] update error:', e)
    } finally {
      setIsProcessing(false)
    }
  }

  const calculateAge = (dob: string) => {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    const age = new Date(diff).getUTCFullYear() - 1970
    return age
  }

  const getDocumentUrl = (path: string | null | undefined) => {
    if (!path) return null
    const { data } = supabase.storage.from('xtrollz-documents').getPublicUrl(path)
    return data.publicUrl
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
        <div className="mx-auto max-w-6xl p-4">
          <button type="button" onClick={() => navigate('/admin')} className="mt-4 ...">Back</button>
          <p className="mt-6 text-sm text-white/60">Admin access required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <div className="mx-auto max-w-7xl p-4">
        <div className="flex items-center justify-between py-4">
          <button type="button" onClick={() => navigate('/admin')} className="...">
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="text-2xl font-black tracking-tight">XTrollz Applications</h1>
          <button type="button" onClick={loadApplications} className="...">
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'submitted', 'under_review', 'more_information_required', 'approved', 'denied', 'suspended', 'revoked', 'expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black ${
                filter === status ? 'bg-pink-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {status.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-white/60">No applications found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/60">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Legal Name</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3">Docs</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Applied</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {applications.map((app) => {
                    const age = calculateAge(app.date_of_birth)
                    return (
                      <tr key={app.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-xs text-white/60 font-mono">
                          {app.id}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-black text-white">{app.troll_city_username || 'Unknown'}</p>
                            <p className="text-xs text-white/60">{app.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {app.legal_first_name} {app.legal_last_name}
                        </td>
                        <td className="px-4 py-3">
                          {age !== null ? (
                            <span className={age >= 21 ? 'text-emerald-300' : 'text-red-300'}>{age}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {app.id_front_url ? <span title="ID Front" className="text-emerald-400">🪪</span> : <span title="Missing ID Front" className="text-red-400">🪪</span>}
                            {app.id_back_url ? <span title="ID Back" className="text-emerald-400">🪪</span> : <span title="Missing ID Back" className="text-red-400">🪪</span>}
                            {app.selfie_url ? <span title="Selfie" className="text-emerald-400">🤳</span> : <span title="Missing Selfie" className="text-red-400">🤳</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${app.xtrollz_role === 'streamer' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                            {(app.xtrollz_role || 'streamer').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${STATUS_COLORS[app.status] || 'bg-gray-500/20 text-gray-300'}`}>
                            {app.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={app.payment_status === 'completed' ? 'text-emerald-300' : 'text-yellow-300'}>
                            {app.payment_status || 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">
                          {new Date(app.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setSelectedApp(app); setReviewNotes(''); setDenialReason(''); setEditDob(app.date_of_birth || ''); setEditRole(app.xtrollz_role === 'viewer' ? 'viewer' : 'streamer') }}
                              className="rounded-lg bg-white/10 px-2 py-1 text-xs font-black hover:bg-white/20"
                            >
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Review Application</h2>
                <button onClick={() => setSelectedApp(null)} className="...">✕</button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-black text-white/60">NAME</p>
                    <p className="font-bold">{selectedApp.legal_first_name} {selectedApp.legal_last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">USERNAME</p>
                     <p className="font-bold">{selectedApp.troll_city_username || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">EMAIL</p>
                    <p className="font-bold">{selectedApp.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">AGE</p>
                    <p className="font-bold">{calculateAge(selectedApp.date_of_birth) ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">COUNTRY</p>
                    <p className="font-bold">{selectedApp.country}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">STATE/PROVINCE</p>
                    <p className="font-bold">{selectedApp.state_province}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">DATE OF BIRTH</p>
                    <input
                      type="date"
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white/60">XTROLLZ ROLE</p>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'streamer' | 'viewer')}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    >
                      <option value="streamer">XTrollerz — Streamer</option>
                      <option value="viewer">XViewer — Viewer</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-black text-white/60">UPLOADED IDENTIFICATION</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {selectedApp.id_front_url && (
                        <a
                          href={getDocumentUrl(selectedApp.id_front_url) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                        >
                          View ID Front
                        </a>
                      )}
                      {selectedApp.id_back_url && (
                        <a
                          href={getDocumentUrl(selectedApp.id_back_url) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                        >
                          View ID Back
                        </a>
                      )}
                      {selectedApp.selfie_url && (
                        <a
                          href={getDocumentUrl(selectedApp.selfie_url) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                        >
                          View Selfie
                        </a>
                      )}
                      {!selectedApp.id_front_url && !selectedApp.id_back_url && !selectedApp.selfie_url && (
                        <span className="text-xs text-white/60">No documents uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-white/60">REVIEWER NOTES</p>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    rows={3}
                  />
                </div>

                {filter === 'denied' || selectedApp.status === 'denied' ? (
                  <div>
                    <p className="text-xs font-black text-white/60">DENIAL REASON</p>
                    <textarea
                      value={denialReason}
                      onChange={(e) => setDenialReason(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-400/30"
                      rows={3}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateStatus(selectedApp.id, 'approved')}
                    disabled={isProcessing}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(selectedApp.id, 'denied')}
                    disabled={isProcessing}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black hover:bg-red-500 disabled:opacity-50"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => updateStatus(selectedApp.id, 'more_information_required')}
                    disabled={isProcessing}
                    className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-black hover:bg-orange-500 disabled:opacity-50"
                  >
                    Request More Info
                  </button>
                  <button
                    onClick={() => updateStatus(selectedApp.id, 'suspended')}
                    disabled={isProcessing}
                    className="rounded-xl bg-yellow-600 px-4 py-2 text-sm font-black hover:bg-yellow-500 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => updateStatus(selectedApp.id, 'revoked')}
                    disabled={isProcessing}
                    className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black hover:bg-red-600 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                  <button
                    onClick={() => updateStatus(selectedApp.id, 'approved')}
                    disabled={isProcessing}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Restore
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
