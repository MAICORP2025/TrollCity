import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  UserRound,
  Video,
  Clock,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import Call from '../../../pages/Call'

interface InterviewScreenProps {
  interviewId: string
  applicantId: string
  interviewerId?: string
  isInterviewer: boolean
  roomName: string
  onClose: () => void
}

interface ApplicationData {
  id: string
  user_id: string
  position_id: string | null
  status: string
  applicant_name?: string | null
  email?: string | null
  phone?: string | null
  cover_letter?: string | null
  resume_url?: string | null
  position?: { title: string | null; role: string | null } | null
}

function formatLabel(value?: string | null): string {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function InterviewScreen({
  interviewId,
  applicantId,
  interviewerId,
  isInterviewer,
  roomName,
  onClose,
}: InterviewScreenProps) {
  const { user } = useAuthStore()
  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [applicationLoading, setApplicationLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [joined, setJoined] = useState(false)
  const [deciding, setDeciding] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('interviews')
          .select(
            'internal_notes, job_application_id, job_applications(id, user_id, position_id, status, applicant_name, email, phone, cover_letter, resume_url, position:career_positions(title, role))',
          )
          .eq('id', interviewId)
          .maybeSingle()

        if (error) throw error
        if (cancelled || !data) return

        const app = (data as any).job_applications as ApplicationData | null
        setApplication(app)
        setNotes((data as any).internal_notes ?? '')
      } catch (error) {
        console.error('Unable to load interview application:', error)
      } finally {
        if (!cancelled) setApplicationLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [interviewId])

  // Mark interview + session as in_progress when interviewer opens the room
  useEffect(() => {
    if (!isInterviewer) return
    let cancelled = false

    const markActive = async () => {
      try {
        await supabase
          .from('interviews')
          .update({ status: 'in_progress' })
          .eq('id', interviewId)
        const { data: row } = await supabase
          .from('interviews')
          .select('call_room_id')
          .eq('id', interviewId)
          .maybeSingle()
        if (row?.call_room_id && !cancelled) {
          await supabase
            .from('interview_sessions')
            .update({ status: 'active' })
            .eq('id', (row as any).call_room_id)
        }
      } catch (error) {
        console.error('Unable to mark interview active:', error)
      }
    }

    void markActive()
    return () => {
      cancelled = true
    }
  }, [interviewId, isInterviewer])

  const saveNotes = useCallback(async () => {
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('interviews')
        .update({ internal_notes: notes })
        .eq('id', interviewId)
      if (error) throw error
      toast.success('Internal notes saved.')
    } catch (error) {
      console.error('Unable to save notes:', error)
      toast.error('Could not save notes.')
    } finally {
      setSavingNotes(false)
    }
  }, [interviewId, notes])

  const decide = useCallback(
    async (decision: 'hire' | 'reject') => {
      if (!user?.id) return
      setDeciding(true)
      try {
        const newStatus = decision === 'hire' ? 'approved' : 'rejected'
        const interviewStatus =
          decision === 'hire' ? 'completed' : 'completed'

        await supabase
          .from('interviews')
          .update({ status: interviewStatus })
          .eq('id', interviewId)

        if (application?.id) {
          const { data: appRow } = await supabase
            .from('job_applications')
            .select('timeline')
            .eq('id', application.id)
            .maybeSingle()
          const existing = Array.isArray(
            (appRow as { timeline?: unknown[] } | null)?.timeline,
          )
            ? ((appRow as { timeline?: unknown[] }).timeline as unknown[])
            : []
          await supabase
            .from('job_applications')
            .update({
              status: newStatus,
              timeline: [
                ...existing,
                {
                  event: `interview_${decision}`,
                  at: new Date().toISOString(),
                  interview_id: interviewId,
                },
              ],
            })
            .eq('id', application.id)
        }

        try {
          await supabase.rpc('log_employee_audit', {
            p_actor: user.id,
            p_action: decision === 'hire' ? 'interview_hire' : 'interview_reject',
            p_target: applicantId,
            p_department: 'human_resources',
          })
        } catch (rpcError) {
          console.warn('log_employee_audit unavailable:', rpcError)
        }

        if (decision === 'hire' && roomName) {
          const { data: sessionRow } = await supabase
            .from('interview_sessions')
            .select('id')
            .eq('room_name', roomName)
            .maybeSingle()
          if (sessionRow) {
            await supabase
              .from('interview_sessions')
              .update({ status: 'hired', ended_at: new Date().toISOString() })
              .eq('id', (sessionRow as any).id)
          }
        } else if (decision === 'reject' && roomName) {
          const { data: sessionRow } = await supabase
            .from('interview_sessions')
            .select('id')
            .eq('room_name', roomName)
            .maybeSingle()
          if (sessionRow) {
            await supabase
              .from('interview_sessions')
              .update({ status: 'rejected', ended_at: new Date().toISOString() })
              .eq('id', (sessionRow as any).id)
          }
        }

        toast.success(
          decision === 'hire'
            ? 'Applicant marked as hired.'
            : 'Applicant rejected.',
        )
        onClose()
      } catch (error) {
        console.error('Unable to complete decision:', error)
        toast.error('Could not record the decision.')
      } finally {
        setDeciding(false)
      }
    },
    [user?.id, interviewId, application?.id, applicantId, roomName, onClose],
  )

  // When the applicant joins, the room is active for them too.
  const otherUserId = isInterviewer ? applicantId : interviewerId ?? ''

  const headerNote = useMemo(() => {
    if (isInterviewer) return 'Interview Room (HR)'
    return 'Your Interview'
  }, [isInterviewer])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#101520]/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-cyan-300" />
          <span className="text-sm font-black">{headerNote}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> Leave
        </button>
      </div>

      <div
        className={`grid gap-4 p-4 ${
          isInterviewer ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''
        }`}
      >
        {/* Video / waiting area */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {joined ? (
            <Call
              roomId={roomName}
              callType="video"
              otherUserId={otherUserId}
            />
          ) : (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#0B0F17] p-10 text-center">
              <Video className="h-12 w-12 text-cyan-300/70" />
              <div>
                <p className="text-lg font-black text-white">
                  {isInterviewer ? 'Interview Room Ready' : 'Waiting Room'}
                </p>
                <p className="mt-1 max-w-md text-sm text-slate-400">
                  {isInterviewer
                    ? 'Start the live video interview when both parties are ready.'
                    : 'The interviewer will admit you shortly. Please wait for your scheduled time.'}
                </p>
              </div>

              {application && (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  Position: {application.position?.title ?? 'General'}
                </p>
              )}

              <button
                type="button"
                onClick={() => setJoined(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950"
              >
                <Video className="h-4 w-4" />
                {isInterviewer ? 'Start Interview' : 'Join Interview'}
              </button>

              {!isInterviewer && (
                <p className="mt-2 flex items-center gap-2 text-[11px] text-amber-200/70">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  You can only access this interview room during your scheduled
                  interview.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Side panel — HR only */}
        {isInterviewer && (
          <aside className="space-y-4 rounded-2xl border border-white/10 bg-[#101520]/80 p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-white">
                <UserRound className="h-4 w-4 text-cyan-300" />
                Applicant Application
              </h3>
              {applicationLoading ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </p>
              ) : !application ? (
                <p className="mt-3 text-xs text-slate-500">
                  Application data unavailable.
                </p>
              ) : (
                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-600">Position</p>
                    <p className="text-slate-200">
                      {application.position?.title ?? 'General'}
                      {application.position?.role
                        ? ` (${formatLabel(application.position.role)})`
                        : ''}
                    </p>
                  </div>
                  {application.applicant_name && (
                    <div>
                      <p className="font-bold text-slate-600">Name</p>
                      <p className="text-slate-200">
                        {application.applicant_name}
                      </p>
                    </div>
                  )}
                  {application.email && (
                    <div>
                      <p className="font-bold text-slate-600">Email</p>
                      <p className="text-slate-200">{application.email}</p>
                    </div>
                  )}
                  {application.phone && (
                    <div>
                      <p className="font-bold text-slate-600">Phone</p>
                      <p className="text-slate-200">{application.phone}</p>
                    </div>
                  )}
                  {application.cover_letter && (
                    <div>
                      <p className="font-bold text-slate-600">Cover Letter</p>
                      <p className="whitespace-pre-wrap text-slate-300">
                        {application.cover_letter}
                      </p>
                    </div>
                  )}
                  {application.resume_url && (
                    <div>
                      <p className="font-bold text-slate-600">Resume</p>
                      <a
                        href={application.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 underline"
                      >
                        Open resume
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-white">
                <FileText className="h-4 w-4 text-cyan-300" />
                Internal Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2 text-sm text-white outline-none"
                placeholder="Private notes (applicant cannot see these)"
              />
              <button
                type="button"
                disabled={savingNotes}
                onClick={() => void saveNotes()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:opacity-40"
              >
                {savingNotes ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save Notes'
                )}
              </button>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-black text-white">Decision</h3>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => void decide('hire')}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" /> Hire
                </button>
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => void decide('reject')}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
