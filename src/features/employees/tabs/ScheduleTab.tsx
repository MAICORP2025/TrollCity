import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileClock,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import OfficerShiftCalendar from '../../../components/officer/OfficerShiftCalendar'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { PermissionGate } from '../components/PermissionGate'

type RequestType = 'time_off' | 'late' | 'cannot_attend'
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

interface ScheduleTabProps {
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

interface OfficerProfileRelation {
  username: string | null
  role?: string | null
}

interface ReviewerProfileRelation {
  username: string | null
}

interface TimeOffRequest {
  id: string
  officer_id: string
  request_date: string
  request_type: RequestType
  reason: string
  status: RequestStatus
  created_at: string
  reviewed_at: string | null
  reviewed_by?: string | null
  management_note?: string | null
  officer?: OfficerProfileRelation | null
  reviewer?: ReviewerProfileRelation | null
}

interface RequestFormState {
  requestType: RequestType
  requestDate: string
  reason: string
}

const INITIAL_FORM: RequestFormState = {
  requestType: 'time_off',
  requestDate: '',
  reason: '',
}

const REQUEST_LIMIT = 100

const REQUEST_TYPE_OPTIONS: Array<{
  value: RequestType
  label: string
  description: string
}> = [
  {
    value: 'time_off',
    label: 'Request Time Off',
    description:
      'Request approval to be unavailable for scheduled work.',
  },
  {
    value: 'late',
    label: 'Report Late Arrival',
    description:
      'Notify management that you expect to arrive after your scheduled start time.',
  },
  {
    value: 'cannot_attend',
    label: 'Report Shift Absence',
    description:
      'Notify management that you cannot attend a scheduled shift.',
  },
]

function getTodayInputValue(): string {
  const now = new Date()
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  )

  return localDate.toISOString().split('T')[0]
}

function parseLocalDate(dateValue: string): Date {
  const [year, month, day] = dateValue
    .split('-')
    .map(Number)

  return new Date(year, month - 1, day)
}

function formatDate(dateValue: string): string {
  if (!dateValue) return 'Unknown date'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseLocalDate(dateValue))
}

function formatDateTime(dateValue?: string | null): string {
  if (!dateValue) return '—'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateValue))
}

function formatRequestType(type: RequestType): string {
  switch (type) {
    case 'time_off':
      return 'Time Off'
    case 'late':
      return 'Late Arrival'
    case 'cannot_attend':
      return 'Shift Absence'
    default:
      return type
  }
}

function getRequestTypeDescription(type: RequestType): string {
  return (
    REQUEST_TYPE_OPTIONS.find(
      (option) => option.value === type,
    )?.description ?? ''
  )
}

function formatStatus(status: RequestStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Pending Review'
  }
}

function getStatusClasses(status: RequestStatus): string {
  switch (status) {
    case 'approved':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
    case 'rejected':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-200'
    case 'cancelled':
      return 'border-slate-500/20 bg-slate-500/10 text-slate-300'
    default:
      return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
  }
}

function getStatusIcon(status: RequestStatus) {
  switch (status) {
    case 'approved':
      return CheckCircle2
    case 'rejected':
      return XCircle
    case 'cancelled':
      return X
    default:
      return Clock3
  }
}

export default function ScheduleTab({
  realProfile,
  previewMode = false,
}: ScheduleTabProps) {
  const { user } = useAuthStore()

  const [requests, setRequests] = useState<
    TimeOffRequest[]
  >([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] =
    useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    if (!user?.id) {
      setRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)

    try {
      const { data, error } = await supabase
        .from('officer_time_off_requests')
        .select(
          `
            id,
            officer_id,
            request_date,
            request_type,
            reason,
            status,
            created_at,
            reviewed_at,
            reviewed_by,
            management_note,
            officer:user_profiles!officer_time_off_requests_officer_id_fkey(
              username,
              role
            ),
            reviewer:user_profiles!officer_time_off_requests_reviewed_by_fkey(
              username
            )
          `,
        )
        .order('created_at', { ascending: false })
        .limit(REQUEST_LIMIT)

      if (error) {
        throw error
      }

      setRequests(
        (data as unknown as TimeOffRequest[] | null) ?? [],
      )
    } catch (error) {
      console.error(
        'Unable to load employee schedule requests:',
        error,
      )

      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load schedule requests.',
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`employee-schedule-requests:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'officer_time_off_requests',
        },
        () => {
          void loadRequests()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadRequests, user?.id])

  const myRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.officer_id === user?.id,
      ),
    [requests, user?.id],
  )

  const requestSummary = useMemo(() => {
    return {
      pending: myRequests.filter(
        (request) => request.status === 'pending',
      ).length,
      approved: myRequests.filter(
        (request) => request.status === 'approved',
      ).length,
      declined: myRequests.filter(
        (request) => request.status === 'rejected',
      ).length,
    }
  }, [myRequests])

  return (
    <div className="space-y-4">
      {previewMode && <PreviewNotice />}

      <ScheduleSummary
        pending={requestSummary.pending}
        approved={requestSummary.approved}
        declined={requestSummary.declined}
      />

      <section className="rounded-2xl border border-white/10 bg-[#101520]/80 p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Assigned Work Schedule
          </p>

          <h2 className="mt-1 text-lg font-black text-white">
            My Upcoming Shifts
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Review your assigned shifts, start times, and upcoming
            work dates.
          </p>
        </div>

        <OfficerShiftCalendar title="Upcoming Shifts" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ScheduleRequestForm
          employeeId={user?.id}
          existingRequests={myRequests}
          onSubmitted={loadRequests}
        />

        <MyScheduleRequests
          employeeId={user?.id}
          requests={myRequests}
          loading={loading}
          error={loadError}
          onChanged={loadRequests}
        />
      </div>

      <PermissionGate
        profile={realProfile}
        action="correct_attendance"
      >
        <ManagementRequests
          reviewerId={user?.id}
          requests={requests}
          loading={loading}
          onChanged={loadRequests}
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
          Schedule requests and shift records remain connected to
          your real employee account. Previewing another role does
          not allow you to submit requests for that role.
        </p>
      </div>
    </div>
  )
}

interface ScheduleSummaryProps {
  pending: number
  approved: number
  declined: number
}

function ScheduleSummary({
  pending,
  approved,
  declined,
}: ScheduleSummaryProps) {
  const summaryItems = [
    {
      label: 'Pending Requests',
      value: pending,
      detail:
        pending === 1
          ? 'Awaiting management review'
          : 'Awaiting management review',
      icon: FileClock,
    },
    {
      label: 'Approved Requests',
      value: approved,
      detail: 'Approved schedule changes',
      icon: CheckCircle2,
    },
    {
      label: 'Declined Requests',
      value: declined,
      detail: 'Requests not approved',
      icon: XCircle,
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {summaryItems.map((item) => {
        const Icon = item.icon

        return (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-[#101520]/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>

                <p className="mt-2 text-2xl font-black text-white">
                  {item.value}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {item.detail}
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

interface ScheduleRequestFormProps {
  employeeId?: string
  existingRequests: TimeOffRequest[]
  onSubmitted: () => void | Promise<void>
}

function ScheduleRequestForm({
  employeeId,
  existingRequests,
  onSubmitted,
}: ScheduleRequestFormProps) {
  const [form, setForm] =
    useState<RequestFormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const minimumDate = getTodayInputValue()
  const normalizedReason = form.reason.trim()

  const duplicatePendingRequest = useMemo(
    () =>
      existingRequests.find(
        (request) =>
          request.status === 'pending' &&
          request.request_date === form.requestDate &&
          request.request_type === form.requestType,
      ),
    [
      existingRequests,
      form.requestDate,
      form.requestType,
    ],
  )

  const updateForm = <K extends keyof RequestFormState>(
    field: K,
    value: RequestFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const submitRequest = async () => {
    if (!employeeId) {
      toast.error('Your employee account could not be verified.')
      return
    }

    if (!form.requestDate) {
      toast.error('Select the affected work date.')
      return
    }

    if (form.requestDate < minimumDate) {
      toast.error(
        'Schedule requests cannot be submitted for a past date.',
      )
      return
    }

    if (normalizedReason.length < 10) {
      toast.error(
        'Provide a reason with at least 10 characters.',
      )
      return
    }

    if (duplicatePendingRequest) {
      toast.error(
        'You already have a pending request of this type for that date.',
      )
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('officer_time_off_requests')
        .insert({
          officer_id: employeeId,
          request_date: form.requestDate,
          reason: normalizedReason,
          request_type: form.requestType,
          status: 'pending',
        })

      if (error) {
        throw error
      }

      toast.success(
        `${formatRequestType(form.requestType)} request submitted.`,
      )

      setForm(INITIAL_FORM)
      await onSubmitted()
    } catch (error) {
      console.error(
        'Unable to submit schedule request:',
        error,
      )

      toast.error(
        error instanceof Error
          ? error.message
          : 'The schedule request could not be submitted.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    Boolean(employeeId) &&
    Boolean(form.requestDate) &&
    form.requestDate >= minimumDate &&
    normalizedReason.length >= 10 &&
    !duplicatePendingRequest &&
    !submitting

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <CalendarClock
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Employee Request
            </p>

            <h2 className="mt-1 text-lg font-black text-white">
              Report a Schedule Change
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Submit time-off requests, late-arrival notices, or
              shift-absence notices for management review.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <label
            htmlFor="schedule-request-type"
            className="text-xs font-bold text-slate-300"
          >
            Request type
          </label>

          <select
            id="schedule-request-type"
            value={form.requestType}
            onChange={(event) =>
              updateForm(
                'requestType',
                event.target.value as RequestType,
              )
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-400/10"
          >
            {REQUEST_TYPE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {getRequestTypeDescription(form.requestType)}
          </p>
        </div>

        <div>
          <label
            htmlFor="schedule-request-date"
            className="text-xs font-bold text-slate-300"
          >
            Affected date
          </label>

          <input
            id="schedule-request-date"
            type="date"
            min={minimumDate}
            value={form.requestDate}
            onChange={(event) =>
              updateForm('requestDate', event.target.value)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-400/10"
          />
        </div>

        <div>
          <label
            htmlFor="schedule-request-reason"
            className="text-xs font-bold text-slate-300"
          >
            Reason and relevant details
          </label>

          <textarea
            id="schedule-request-reason"
            value={form.reason}
            onChange={(event) =>
              updateForm('reason', event.target.value)
            }
            placeholder="Explain the reason for this request and include any details management should know."
            maxLength={1000}
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-white/10 bg-[#090D15] p-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-400/10"
          />

          <div className="mt-1 flex justify-between gap-3 text-[10px]">
            <span
              className={
                normalizedReason.length > 0 &&
                normalizedReason.length < 10
                  ? 'text-rose-300'
                  : 'text-slate-500'
              }
            >
              Minimum 10 characters
            </span>

            <span className="text-slate-500">
              {form.reason.length}/1000
            </span>
          </div>
        </div>

        {duplicatePendingRequest && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
              aria-hidden="true"
            />

            <p className="text-xs leading-5 text-amber-100/70">
              A pending {formatRequestType(form.requestType).toLowerCase()}{' '}
              request already exists for{' '}
              {formatDate(form.requestDate)}.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submitRequest()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}

          Submit for Review
        </button>
      </div>
    </section>
  )
}

interface MyScheduleRequestsProps {
  employeeId?: string
  requests: TimeOffRequest[]
  loading: boolean
  error: string | null
  onChanged: () => void | Promise<void>
}

function MyScheduleRequests({
  employeeId,
  requests,
  loading,
  error,
  onChanged,
}: MyScheduleRequestsProps) {
  const [cancellingId, setCancellingId] =
    useState<string | null>(null)

  const cancelRequest = async (
    request: TimeOffRequest,
  ) => {
    if (!employeeId) return

    const confirmed = window.confirm(
      `Cancel your ${formatRequestType(
        request.request_type,
      ).toLowerCase()} request for ${formatDate(
        request.request_date,
      )}?`,
    )

    if (!confirmed) return

    setCancellingId(request.id)

    try {
      const { error: updateError } = await supabase
        .from('officer_time_off_requests')
        .update({
          status: 'cancelled',
        })
        .eq('id', request.id)
        .eq('officer_id', employeeId)
        .eq('status', 'pending')

      if (updateError) {
        throw updateError
      }

      toast.success('Schedule request cancelled.')
      await onChanged()
    } catch (cancelError) {
      console.error(
        'Unable to cancel schedule request:',
        cancelError,
      )

      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : 'The request could not be cancelled.',
      )
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Request History
          </p>

          <h2 className="mt-1 text-lg font-black text-white">
            My Schedule Requests
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void onChanged()}
          disabled={loading}
          aria-label="Refresh schedule requests"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? 'animate-spin' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {loading && requests.length === 0 ? (
          <ScheduleRequestLoading />
        ) : error ? (
          <ScheduleRequestError message={error} />
        ) : requests.length === 0 ? (
          <ScheduleRequestEmpty />
        ) : (
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {requests.map((request) => (
              <EmployeeRequestCard
                key={request.id}
                request={request}
                cancelling={
                  cancellingId === request.id
                }
                onCancel={cancelRequest}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EmployeeRequestCard({
  request,
  cancelling,
  onCancel,
}: {
  request: TimeOffRequest
  cancelling: boolean
  onCancel: (request: TimeOffRequest) => void
}) {
  const StatusIcon = getStatusIcon(request.status)

  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
            <CalendarDays
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-white">
              {formatRequestType(request.request_type)}
            </p>

            <p className="mt-1 text-xs font-semibold text-cyan-300">
              {formatDate(request.request_date)}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">
              {request.reason}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(
            request.status,
          )}`}
        >
          <StatusIcon
            className="h-3 w-3"
            aria-hidden="true"
          />
          {formatStatus(request.status)}
        </span>
      </div>

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <div className="flex flex-col justify-between gap-2 text-[11px] text-slate-500 sm:flex-row sm:items-center">
          <span>
            Submitted {formatDateTime(request.created_at)}
          </span>

          {request.reviewed_at && (
            <span>
              Reviewed {formatDateTime(request.reviewed_at)}
              {request.reviewer?.username
                ? ` by ${request.reviewer.username}`
                : ''}
            </span>
          )}
        </div>

        {request.management_note && (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Management Note
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-300">
              {request.management_note}
            </p>
          </div>
        )}

        {request.status === 'pending' && (
          <button
            type="button"
            disabled={cancelling}
            onClick={() => onCancel(request)}
            className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50"
          >
            {cancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}

            Cancel Request
          </button>
        )}
      </div>
    </article>
  )
}

function ScheduleRequestLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300" />

        <p className="mt-3 text-sm font-bold text-slate-300">
          Loading schedule requests
        </p>
      </div>
    </div>
  )
}

function ScheduleRequestError({
  message,
}: {
  message: string
}) {
  return (
    <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-5 text-center">
      <AlertCircle className="mx-auto h-7 w-7 text-rose-300" />

      <p className="mt-3 text-sm font-bold text-rose-100">
        Schedule requests could not be loaded
      </p>

      <p className="mt-1 text-xs leading-5 text-rose-100/60">
        {message}
      </p>
    </div>
  )
}

function ScheduleRequestEmpty() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
      <div>
        <FileClock className="mx-auto h-8 w-8 text-slate-600" />

        <p className="mt-3 text-sm font-bold text-slate-300">
          No schedule requests
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Time-off requests, late notices, and absence reports will
          appear here.
        </p>
      </div>
    </div>
  )
}

interface ManagementRequestsProps {
  reviewerId?: string
  requests: TimeOffRequest[]
  loading: boolean
  onChanged: () => void | Promise<void>
}

function ManagementRequests({
  reviewerId,
  requests,
  loading,
  onChanged,
}: ManagementRequestsProps) {
  const [selectedRequest, setSelectedRequest] =
    useState<TimeOffRequest | null>(null)
  const [managementNote, setManagementNote] =
    useState('')
  const [processingId, setProcessingId] =
    useState<string | null>(null)

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status === 'pending',
      ),
    [requests],
  )

  const closeReview = () => {
    setSelectedRequest(null)
    setManagementNote('')
  }

  const reviewRequest = async (
    request: TimeOffRequest,
    status: 'approved' | 'rejected',
  ) => {
    if (!reviewerId) {
      toast.error(
        'Your management account could not be verified.',
      )
      return
    }

    if (
      status === 'rejected' &&
      managementNote.trim().length < 5
    ) {
      toast.error(
        'Enter a management note explaining why the request was declined.',
      )
      return
    }

    const actionLabel =
      status === 'approved' ? 'approve' : 'decline'

    const confirmed = window.confirm(
      `${actionLabel[0].toUpperCase()}${actionLabel.slice(
        1,
      )} ${request.officer?.username ?? 'this employee'}’s ${formatRequestType(
        request.request_type,
      ).toLowerCase()} request for ${formatDate(
        request.request_date,
      )}?`,
    )

    if (!confirmed) return

    setProcessingId(request.id)

    try {
      const reviewedAt = new Date().toISOString()
      const note = managementNote.trim() || null

      const { data: updatedRequest, error: updateError } =
        await supabase
          .from('officer_time_off_requests')
          .update({
            status,
            reviewed_at: reviewedAt,
            reviewed_by: reviewerId,
            management_note: note,
          })
          .eq('id', request.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

      if (updateError) {
        throw updateError
      }

      if (!updatedRequest) {
        throw new Error(
          'This request was already reviewed or is no longer pending.',
        )
      }

      /**
       * Approved time-off and absence requests remove the employee's
       * assigned shift for the affected date.
       *
       * Late-arrival notices do not remove the shift because the
       * employee is still expected to work.
       */
      if (
        status === 'approved' &&
        request.request_type !== 'late'
      ) {
        const { error: shiftError } = await supabase
          .from('officer_shift_slots')
          .delete()
          .eq('officer_id', request.officer_id)
          .eq('shift_date', request.request_date)

        if (shiftError) {
          console.error(
            'Request approved, but assigned shift could not be removed:',
            shiftError,
          )

          toast.warning(
            'The request was approved, but the assigned shift could not be removed automatically.',
          )
        }
      }

      const { error: auditError } = await supabase.rpc(
        'log_employee_audit',
        {
          p_actor: reviewerId,
          p_action:
            status === 'approved'
              ? 'schedule_request_approved'
              : 'schedule_request_rejected',
          p_target: request.officer_id,
          p_reason:
            note ??
            `${formatRequestType(
              request.request_type,
            )} request ${status}.`,
          p_department: 'scheduling',
        },
      )

      if (auditError) {
        console.error(
          'Schedule request reviewed but audit logging failed:',
          auditError,
        )
      }

      toast.success(
        `${formatRequestType(request.request_type)} request ${
          status === 'approved'
            ? 'approved'
            : 'declined'
        }.`,
      )

      closeReview()
      await onChanged()
    } catch (error) {
      console.error(
        'Unable to review schedule request:',
        error,
      )

      toast.error(
        error instanceof Error
          ? error.message
          : 'The request could not be reviewed.',
      )
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-500/[0.045]">
      <div className="flex flex-col justify-between gap-3 border-b border-amber-400/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
            <ShieldCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/60">
              Management Review
            </p>

            <h2 className="mt-1 text-lg font-black text-amber-100">
              Pending Schedule Requests
            </h2>

            <p className="mt-1 text-xs leading-5 text-amber-100/60">
              Review employee availability requests and document
              each scheduling decision.
            </p>
          </div>
        </div>

        <span className="inline-flex self-start rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200 sm:self-auto">
          {pendingRequests.length} Pending
        </span>
      </div>

      <div className="p-3 sm:p-4">
        {loading && requests.length === 0 ? (
          <ScheduleRequestLoading />
        ) : pendingRequests.length === 0 ? (
          <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-amber-400/10 bg-black/10 p-6 text-center">
            <div>
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400/70" />

              <p className="mt-3 text-sm font-bold text-slate-300">
                No pending requests
              </p>

              <p className="mt-1 text-xs text-slate-500">
                All employee scheduling requests have been reviewed.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <ManagementRequestCard
                key={request.id}
                request={request}
                selected={
                  selectedRequest?.id === request.id
                }
                processing={
                  processingId === request.id
                }
                managementNote={managementNote}
                onSelect={() => {
                  setSelectedRequest(request)
                  setManagementNote('')
                }}
                onClose={closeReview}
                onNoteChange={setManagementNote}
                onApprove={() =>
                  void reviewRequest(request, 'approved')
                }
                onReject={() =>
                  void reviewRequest(request, 'rejected')
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

interface ManagementRequestCardProps {
  request: TimeOffRequest
  selected: boolean
  processing: boolean
  managementNote: string
  onSelect: () => void
  onClose: () => void
  onNoteChange: (value: string) => void
  onApprove: () => void
  onReject: () => void
}

function ManagementRequestCard({
  request,
  selected,
  processing,
  managementNote,
  onSelect,
  onClose,
  onNoteChange,
  onApprove,
  onReject,
}: ManagementRequestCardProps) {
  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
            <UserRound
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-white">
              {request.officer?.username ??
                'Unknown Employee'}
            </p>

            <p className="mt-1 text-xs font-semibold text-amber-200">
              {formatRequestType(request.request_type)}
              <span className="mx-2 text-slate-600">·</span>
              {formatDate(request.request_date)}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">
              {request.reason}
            </p>

            <p className="mt-2 text-[10px] text-slate-600">
              Submitted {formatDateTime(request.created_at)}
            </p>
          </div>
        </div>

        {!selected && (
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-500/15"
          >
            Review Request
          </button>
        )}
      </div>

      {selected && (
        <div className="mt-4 border-t border-white/[0.07] pt-4">
          <label
            htmlFor={`management-note-${request.id}`}
            className="text-xs font-bold text-slate-300"
          >
            Management note
          </label>

          <textarea
            id={`management-note-${request.id}`}
            value={managementNote}
            onChange={(event) =>
              onNoteChange(event.target.value)
            }
            placeholder="Add a note explaining the approval or decline decision."
            maxLength={1000}
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/30 focus:ring-2 focus:ring-amber-400/10"
          />

          <p className="mt-1 text-right text-[10px] text-slate-500">
            {managementNote.length}/1000
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={processing}
              onClick={onApprove}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}

              Approve Request
            </button>

            <button
              type="button"
              disabled={
                processing ||
                managementNote.trim().length < 5
              }
              onClick={onReject}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}

              Decline Request
            </button>

            <button
              type="button"
              disabled={processing}
              onClick={onClose}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Close
            </button>
          </div>

          {request.request_type === 'late' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-cyan-400/15 bg-cyan-500/[0.05] px-3 py-2">
              <Clock3
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300"
                aria-hidden="true"
              />

              <p className="text-[11px] leading-5 text-cyan-100/65">
                Approving a late-arrival notice will not remove the
                employee’s shift. The employee remains scheduled to
                work that date.
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  )
}