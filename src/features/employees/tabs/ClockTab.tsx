import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  Search,
  ShieldCheck,
  TimerOff,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import OfficerClock from '../../../components/officer/OfficerClock'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { format12hr } from '../../../utils/timeFormat'

import { PermissionGate } from '../components/PermissionGate'

interface ClockTabProps {
  profile?: EmployeeProfileLike | null
  realProfile?: EmployeeProfileLike | null
  previewMode?: boolean
}

interface EmployeeProfileLike {
  id?: string
  username?: string | null
  role?: string | null
  [key: string]: unknown
}

interface WorkSession {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | string | null
  auto_clocked_out: boolean | null
  status: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface EmployeeSearchResult {
  id: string
  username: string | null
  role: string | null
}

interface ActiveEmployeeSession {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  status: string | null
}

const SESSION_LIMIT = 30

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value?: string | null): string {
  if (!value) return '—'

  return format12hr(new Date(value))
}

function getHoursWorked(session: WorkSession): number {
  const storedHours = Number(session.hours_worked)

  if (Number.isFinite(storedHours) && storedHours > 0) {
    return storedHours
  }

  const clockIn = new Date(session.clock_in).getTime()
  const clockOut = session.clock_out
    ? new Date(session.clock_out).getTime()
    : Date.now()

  if (
    !Number.isFinite(clockIn) ||
    !Number.isFinite(clockOut) ||
    clockOut <= clockIn
  ) {
    return 0
  }

  return (clockOut - clockIn) / 3_600_000
}

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0h 0m'
  }

  const totalMinutes = Math.round(hours * 60)
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${wholeHours}h ${minutes}m`
}

function formatRole(role?: string | null): string {
  if (!role) return 'Employee'

  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getSessionStatusLabel(session: WorkSession): string {
  if (!session.clock_out) {
    if (session.status === 'break') return 'On Break'
    if (session.status === 'meal') return 'Meal Period'
    return 'Active'
  }

  if (session.auto_clocked_out) {
    return 'Automatically Closed'
  }

  return 'Completed'
}

function getSessionStatusClasses(session: WorkSession): string {
  if (!session.clock_out) {
    if (
      session.status === 'break' ||
      session.status === 'meal'
    ) {
      return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
    }

    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
  }

  if (session.auto_clocked_out) {
    return 'border-orange-400/20 bg-orange-500/10 text-orange-200'
  }

  return 'border-slate-600/40 bg-slate-800/70 text-slate-300'
}

export default function ClockTab({
  realProfile,
  previewMode = false,
}: ClockTabProps) {
  const { user } = useAuthStore()

  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (!user?.id) {
      setSessions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)

    try {
      const { data, error } = await supabase
        .from('officer_work_sessions')
        .select(
          `
            id,
            officer_id,
            clock_in,
            clock_out,
            hours_worked,
            auto_clocked_out,
            status,
            created_at,
            updated_at
          `,
        )
        .eq('officer_id', user.id)
        .order('clock_in', { ascending: false })
        .limit(SESSION_LIMIT)

      if (error) {
        throw error
      }

      setSessions((data as WorkSession[] | null) ?? [])
    } catch (error) {
      console.error('Unable to load attendance history:', error)

      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load attendance history.',
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`employee-attendance-history:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'officer_work_sessions',
          filter: `officer_id=eq.${user.id}`,
        },
        () => {
          void loadSessions()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadSessions, user?.id])

  const attendanceSummary = useMemo(() => {
    const completedSessions = sessions.filter(
      (session) => Boolean(session.clock_out),
    )

    const totalHours = completedSessions.reduce(
      (total, session) => total + getHoursWorked(session),
      0,
    )

    const automaticClosures = completedSessions.filter(
      (session) => session.auto_clocked_out,
    ).length

    return {
      completedSessions: completedSessions.length,
      totalHours,
      automaticClosures,
    }
  }, [sessions])

  return (
    <div className="space-y-4">
      {previewMode && (
        <PreviewNotice />
      )}

      <AttendanceSummary
        sessions={sessions}
        completedSessions={attendanceSummary.completedSessions}
        totalHours={attendanceSummary.totalHours}
        automaticClosures={attendanceSummary.automaticClosures}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0">
          <OfficerClock />
        </section>

        <AttendanceHistory
          sessions={sessions}
          loading={loading}
          error={loadError}
          onRetry={loadSessions}
        />
      </div>

      <PermissionGate
        profile={realProfile}
        action="correct_attendance"
      >
        <ManagementCorrections
          actorUserId={user?.id}
          onChanged={loadSessions}
        />
      </PermissionGate>
    </div>
  )
}

function PreviewNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
      <ShieldCheck
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
        aria-hidden="true"
      />

      <div>
        <p className="text-sm font-bold text-amber-100">
          Administrative preview is active
        </p>

        <p className="mt-1 text-xs leading-5 text-amber-100/70">
          Attendance records and clock actions still belong to your
          real employee account. Role preview does not create or
          modify another employee’s work session.
        </p>
      </div>
    </div>
  )
}

interface AttendanceSummaryProps {
  sessions: WorkSession[]
  completedSessions: number
  totalHours: number
  automaticClosures: number
}

function AttendanceSummary({
  sessions,
  completedSessions,
  totalHours,
  automaticClosures,
}: AttendanceSummaryProps) {
  const activeSession = sessions.find(
    (session) => !session.clock_out,
  )

  const cards = [
    {
      label: 'Current Status',
      value: activeSession
        ? activeSession.status === 'break'
          ? 'On Break'
          : activeSession.status === 'meal'
            ? 'Meal Period'
            : 'Clocked In'
        : 'Clocked Out',
      detail: activeSession
        ? `Started ${formatTime(activeSession.clock_in)}`
        : 'No active work session',
      icon: Clock3,
    },
    {
      label: 'Recorded Hours',
      value: formatDuration(totalHours),
      detail: `Across ${completedSessions} completed ${
        completedSessions === 1 ? 'shift' : 'shifts'
      }`,
      icon: History,
    },
    {
      label: 'Automatic Closures',
      value: automaticClosures.toString(),
      detail:
        automaticClosures > 0
          ? 'Review these entries for accuracy'
          : 'No automatic clock-outs recorded',
      icon: TimerOff,
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-[#101520]/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.label}
                </p>

                <p className="mt-2 text-xl font-black text-white">
                  {card.value}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {card.detail}
                </p>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/15">
                <Icon
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

interface AttendanceHistoryProps {
  sessions: WorkSession[]
  loading: boolean
  error: string | null
  onRetry: () => Promise<void>
}

function AttendanceHistory({
  sessions,
  loading,
  error,
  onRetry,
}: AttendanceHistoryProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Timekeeping Records
          </p>

          <h2 className="mt-1 text-lg font-black text-white">
            Attendance History
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Your latest {SESSION_LIMIT} work sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <History className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {loading && sessions.length === 0 ? (
          <AttendanceLoadingState />
        ) : error ? (
          <AttendanceErrorState
            message={error}
            onRetry={onRetry}
          />
        ) : sessions.length === 0 ? (
          <AttendanceEmptyState />
        ) : (
          <div className="max-h-[580px] space-y-2 overflow-y-auto pr-1">
            {sessions.map((session) => (
              <AttendanceSessionRow
                key={session.id}
                session={session}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function AttendanceSessionRow({
  session,
}: {
  session: WorkSession
}) {
  const hoursWorked = getHoursWorked(session)

  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3 transition hover:border-white/10 hover:bg-white/[0.05] sm:p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
            <CalendarDays
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-white">
              {formatDate(session.clock_in)}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {formatTime(session.clock_in)}
              <span className="mx-2 text-slate-600">–</span>
              {session.clock_out
                ? formatTime(session.clock_out)
                : 'Currently active'}
            </p>

            <span
              className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getSessionStatusClasses(
                session,
              )}`}
            >
              {getSessionStatusLabel(session)}
            </span>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
          <p className="text-lg font-black text-cyan-300">
            {formatDuration(hoursWorked)}
          </p>

          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recorded Time
          </p>
        </div>
      </div>

      {session.auto_clocked_out && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-400/15 bg-orange-500/[0.06] px-3 py-2">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300"
            aria-hidden="true"
          />

          <p className="text-[11px] leading-5 text-orange-100/70">
            This work session was closed automatically. Contact
            management if the recorded time is not accurate.
          </p>
        </div>
      )}
    </article>
  )
}

function AttendanceLoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300" />

        <p className="mt-3 text-sm font-bold text-slate-300">
          Loading attendance records
        </p>
      </div>
    </div>
  )
}

function AttendanceEmptyState() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
      <div>
        <History className="mx-auto h-8 w-8 text-slate-600" />

        <p className="mt-3 text-sm font-bold text-slate-300">
          No attendance records yet
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Your completed and active work sessions will appear here
          after you use the employee clock.
        </p>
      </div>
    </div>
  )
}

function AttendanceErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => Promise<void>
}) {
  return (
    <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-5 text-center">
      <AlertTriangle className="mx-auto h-7 w-7 text-rose-300" />

      <p className="mt-3 text-sm font-bold text-rose-100">
        Attendance records could not be loaded
      </p>

      <p className="mt-1 text-xs leading-5 text-rose-100/60">
        {message}
      </p>

      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-4 rounded-lg border border-rose-300/20 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-100 hover:bg-rose-500/15"
      >
        Try Again
      </button>
    </div>
  )
}

interface ManagementCorrectionsProps {
  actorUserId?: string
  onChanged: () => void | Promise<void>
}

function ManagementCorrections({
  actorUserId,
  onChanged,
}: ManagementCorrectionsProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [employee, setEmployee] =
    useState<EmployeeSearchResult | null>(null)
  const [activeSession, setActiveSession] =
    useState<ActiveEmployeeSession | null>(null)
  const [reason, setReason] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchError, setSearchError] =
    useState<string | null>(null)

  const resetForm = () => {
    setSearchTerm('')
    setEmployee(null)
    setActiveSession(null)
    setReason('')
    setSearchError(null)
  }

  const findEmployeeSession = async () => {
    const normalizedSearch = searchTerm.trim()

    if (!normalizedSearch) {
      setSearchError('Enter an employee username.')
      return
    }

    setSearching(true)
    setSearchError(null)
    setEmployee(null)
    setActiveSession(null)

    try {
      const { data: profileData, error: profileError } =
        await supabase
          .from('user_profiles')
          .select('id, username, role')
          .ilike('username', normalizedSearch)
          .limit(1)
          .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (!profileData) {
        setSearchError('No employee was found with that username.')
        return
      }

      const foundEmployee =
        profileData as EmployeeSearchResult

      const { data: sessionData, error: sessionError } =
        await supabase
          .from('officer_work_sessions')
          .select(
            `
              id,
              officer_id,
              clock_in,
              clock_out,
              status
            `,
          )
          .eq('officer_id', foundEmployee.id)
          .is('clock_out', null)
          .order('clock_in', { ascending: false })
          .limit(1)
          .maybeSingle()

      if (sessionError) {
        throw sessionError
      }

      setEmployee(foundEmployee)
      setActiveSession(
        (sessionData as ActiveEmployeeSession | null) ?? null,
      )
    } catch (error) {
      console.error(
        'Unable to locate employee attendance session:',
        error,
      )

      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search employee attendance records.',
      )
    } finally {
      setSearching(false)
    }
  }

  const submitCorrection = async () => {
    const normalizedReason = reason.trim()

    if (!actorUserId) {
      toast.error('Your management account could not be verified.')
      return
    }

    if (!employee) {
      toast.error('Select an employee before submitting.')
      return
    }

    if (!activeSession) {
      toast.error(
        'This employee does not have an active work session.',
      )
      return
    }

    if (normalizedReason.length < 10) {
      toast.error(
        'Enter a correction reason with at least 10 characters.',
      )
      return
    }

    const confirmed = window.confirm(
      `Manually clock out ${employee.username ?? 'this employee'}? This action will be recorded in the employee audit log.`,
    )

    if (!confirmed) return

    setSubmitting(true)

    try {
      /**
       * The RPC requires the work-session ID.
       * Do not pass the employee profile ID here.
       */
      const { error: clockOutError } = await supabase.rpc(
        'manual_clock_out',
        {
          p_session_id: activeSession.id,
        },
      )

      if (clockOutError) {
        throw clockOutError
      }

      const { error: auditError } = await supabase.rpc(
        'log_employee_audit',
        {
          p_actor: actorUserId,
          p_action: 'manual_attendance_clock_out',
          p_target: employee.id,
          p_reason: normalizedReason,
          p_department: 'attendance',
        },
      )

      if (auditError) {
        console.error(
          'Attendance was corrected but audit logging failed:',
          auditError,
        )

        toast.warning(
          'The employee was clocked out, but the audit entry could not be confirmed.',
        )
      } else {
        toast.success(
          `${employee.username ?? 'Employee'} was clocked out successfully.`,
        )
      }

      resetForm()
      await onChanged()
    } catch (error) {
      console.error(
        'Unable to submit attendance correction:',
        error,
      )

      toast.error(
        error instanceof Error
          ? error.message
          : 'Attendance correction failed.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    Boolean(employee) &&
    Boolean(activeSession) &&
    reason.trim().length >= 10 &&
    Boolean(actorUserId) &&
    !submitting

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-500/[0.045]">
      <div className="border-b border-amber-400/10 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
            <ShieldCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/60">
              Management Access
            </p>

            <h2 className="mt-1 text-lg font-black text-amber-100">
              Attendance Correction
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-amber-100/60">
              Use this tool only when an employee cannot end an
              active work session. Every correction requires a
              business reason and is recorded in the employee audit
              history.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <label
            htmlFor="attendance-employee-search"
            className="text-xs font-bold text-slate-300"
          >
            Employee username
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <UserRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />

              <input
                id="attendance-employee-search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setEmployee(null)
                  setActiveSession(null)
                  setSearchError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void findEmployeeSession()
                  }
                }}
                placeholder="Enter the full employee username"
                autoComplete="off"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/30 focus:ring-2 focus:ring-amber-400/10"
              />
            </div>

            <button
              type="button"
              onClick={() => void findEmployeeSession()}
              disabled={searching || !searchTerm.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}

              Find Employee
            </button>
          </div>

          {searchError && (
            <p className="mt-2 text-xs text-rose-300">
              {searchError}
            </p>
          )}
        </div>

        {employee && (
          <EmployeeCorrectionResult
            employee={employee}
            activeSession={activeSession}
          />
        )}

        <div>
          <label
            htmlFor="attendance-correction-reason"
            className="text-xs font-bold text-slate-300"
          >
            Management reason
          </label>

          <textarea
            id="attendance-correction-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this employee’s active session must be manually closed."
            maxLength={1000}
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/30 focus:ring-2 focus:ring-amber-400/10"
          />

          <div className="mt-1 flex justify-between gap-3 text-[10px]">
            <span
              className={
                reason.trim().length > 0 &&
                reason.trim().length < 10
                  ? 'text-rose-300'
                  : 'text-slate-500'
              }
            >
              Minimum 10 characters required
            </span>

            <span className="text-slate-500">
              {reason.length}/1000
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void submitCorrection()}
            disabled={!canSubmit}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TimerOff className="h-4 w-4" />
            )}

            Manually Clock Out Employee
          </button>

          {(employee || reason || searchTerm) && (
            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function EmployeeCorrectionResult({
  employee,
  activeSession,
}: {
  employee: EmployeeSearchResult
  activeSession: ActiveEmployeeSession | null
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        activeSession
          ? 'border-emerald-400/20 bg-emerald-500/[0.06]'
          : 'border-slate-600/40 bg-slate-800/60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            activeSession
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'bg-slate-700 text-slate-400'
          }`}
        >
          {activeSession ? (
            <CheckCircle2
              className="h-5 w-5"
              aria-hidden="true"
            />
          ) : (
            <Clock3
              className="h-5 w-5"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-bold text-white">
            {employee.username ?? 'Unnamed Employee'}
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            {formatRole(employee.role)}
          </p>

          {activeSession ? (
            <div className="mt-3">
              <p className="text-xs font-bold text-emerald-200">
                Active work session found
              </p>

              <p className="mt-1 text-xs text-emerald-100/60">
                Clocked in on {formatDate(activeSession.clock_in)} at{' '}
                {formatTime(activeSession.clock_in)}
                {activeSession.status
                  ? ` · Status: ${formatRole(activeSession.status)}`
                  : ''}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-slate-400">
              This employee does not currently have an open work
              session. No manual clock-out can be submitted.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}