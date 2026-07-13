import React, { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Download,
  FileText,
  Loader2,
  Printer,
  ShieldCheck,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'

interface EmploymentRecord {
  id: string
  employee_number: string
  legal_name: string
  preferred_name: string | null
  job_title: string
  department: string | null
  employment_classification: string
  employment_status: string
  employment_type: string | null
  start_date: string
  end_date: string | null
  pay_type: string | null
  hourly_rate: number | null
  annual_salary: number | null
  verification_enabled: boolean
}

interface VerificationSnapshot {
  employee_number: string
  legal_name: string
  preferred_name: string | null
  job_title: string
  department: string | null
  employment_classification: string
  employment_status: string
  employment_type: string | null
  start_date: string
  end_date: string | null
  pay_type: string | null
  hourly_rate: number | null
  annual_salary: number | null
  average_hours: number | null
  generated_at: string
}

interface GeneratedVerification {
  success: boolean
  verification_id: string
  verification_code: string
  expires_at: string
  snapshot: VerificationSnapshot
}

function formatLabel(value?: string | null) {
  if (!value) return 'Not specified'

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value?: string | null) {
  if (!value) return 'Not specified'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return null

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export default function EmploymentVerificationTab() {
  const { user } = useAuthStore()

  const [record, setRecord] = useState<EmploymentRecord | null>(null)
  const [verification, setVerification] =
    useState<GeneratedVerification | null>(null)

  const [recipientName, setRecipientName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [includeCompensation, setIncludeCompensation] = useState(false)
  const [includeAverageHours, setIncludeAverageHours] = useState(false)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    let alive = true

    const loadRecord = async () => {
      setLoading(true)
      setError(null)

      const { data, error: recordError } = await supabase
        .from('employee_records')
        .select(`
          id,
          employee_number,
          legal_name,
          preferred_name,
          job_title,
          department,
          employment_classification,
          employment_status,
          employment_type,
          start_date,
          end_date,
          pay_type,
          hourly_rate,
          annual_salary,
          verification_enabled
        `)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!alive) return

      if (recordError) {
        setError(recordError.message)
        setRecord(null)
      } else {
        setRecord(data as EmploymentRecord | null)
      }

      setLoading(false)
    }

    void loadRecord()

    return () => {
      alive = false
    }
  }, [user?.id])

  const canGenerate = useMemo(() => {
    return Boolean(
      record &&
      record.verification_enabled &&
      record.employment_status !== 'terminated'
    )
  }, [record])

  const generateVerification = async () => {
    if (!user?.id || !canGenerate) return

    setGenerating(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'generate_employment_verification',
        {
          p_employee_user_id: user.id,
          p_purpose: purpose.trim() || null,
          p_recipient_name: recipientName.trim() || null,
          p_include_compensation: includeCompensation,
          p_include_average_hours: includeAverageHours,
        }
      )

      if (rpcError) throw rpcError

      setVerification(data as GeneratedVerification)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Employment verification could not be generated.'
      )
    } finally {
      setGenerating(false)
    }
  }

  const printVerification = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
        <p className="mt-3 text-sm text-slate-400">
          Loading employment record…
        </p>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 text-amber-300" />

          <div>
            <h2 className="font-bold text-amber-100">
              Employment record unavailable
            </h2>

            <p className="mt-1 text-sm text-amber-100/70">
              Your employee role exists, but Human Resources has not completed
              the employment record required to generate official verification.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="print:hidden rounded-2xl border border-white/10 bg-black/30 p-5">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-1 h-7 w-7 text-cyan-300" />

          <div>
            <h2 className="text-xl font-black">Employment Verification</h2>

            <p className="mt-1 text-sm text-slate-400">
              Generate a verified letter using your official employee record.
            </p>
          </div>
        </div>
      </section>

      <section className="print:hidden grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="font-bold">Employment record</h3>

          <dl className="mt-4 space-y-3 text-sm">
            <RecordLine label="Legal name" value={record.legal_name} />
            <RecordLine
              label="Employee number"
              value={record.employee_number}
            />
            <RecordLine label="Job title" value={record.job_title} />
            <RecordLine
              label="Department"
              value={record.department || 'Not assigned'}
            />
            <RecordLine
              label="Classification"
              value={formatLabel(record.employment_classification)}
            />
            <RecordLine
              label="Status"
              value={formatLabel(record.employment_status)}
            />
            <RecordLine
              label="Start date"
              value={formatDate(record.start_date)}
            />
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="font-bold">Letter options</h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Recipient or organization
              </span>

              <input
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder="Apartment manager, lender, agency, etc."
                maxLength={150}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-cyan-400/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Purpose
              </span>

              <textarea
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="Housing application, income verification, loan, benefits, etc."
                maxLength={500}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-cyan-400/50"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
              <input
                type="checkbox"
                checked={includeCompensation}
                onChange={(event) =>
                  setIncludeCompensation(event.target.checked)
                }
              />

              <span className="text-sm">Include compensation information</span>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
              <input
                type="checkbox"
                checked={includeAverageHours}
                onChange={(event) =>
                  setIncludeAverageHours(event.target.checked)
                }
              />

              <span className="text-sm">
                Include average completed shift hours
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={!canGenerate || generating}
              onClick={generateVerification}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}

              {generating
                ? 'Generating verification…'
                : 'Generate verification letter'}
            </button>
          </div>
        </div>
      </section>

      {verification && (
        <>
          <div className="print:hidden flex flex-wrap gap-2">
            <button
              type="button"
              onClick={printVerification}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"
            >
              <Printer className="h-4 w-4" />
              Print or save as PDF
            </button>

            <button
              type="button"
              onClick={printVerification}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>

          <VerificationLetter
            verification={verification}
            recipientName={recipientName}
            purpose={purpose}
          />
        </>
      )}
    </div>
  )
}

function RecordLine({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-200">{value}</dd>
    </div>
  )
}

function VerificationLetter({
  verification,
  recipientName,
  purpose,
}: {
  verification: GeneratedVerification
  recipientName: string
  purpose: string
}) {
  const snapshot = verification.snapshot

  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify-employment?code=${encodeURIComponent(
          verification.verification_code
        )}`
      : ''

  return (
    <article
      id="employment-verification-letter"
      className="mx-auto max-w-[850px] rounded-2xl border border-white/10 bg-white p-8 text-black shadow-2xl print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="border-b-2 border-black pb-5">
        <p className="text-sm font-bold uppercase tracking-[0.2em]">
          MAI Corp
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Employment Verification
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Troll City Employee Administration
        </p>
      </header>

      <div className="mt-8 text-sm leading-7">
        <p>
          <strong>Date:</strong>{' '}
          {new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }).format(new Date(snapshot.generated_at))}
        </p>

        {recipientName.trim() && (
          <p>
            <strong>Recipient:</strong> {recipientName.trim()}
          </p>
        )}

        <p className="mt-6">To whom it may concern:</p>

        <p className="mt-4">
          This letter verifies that{' '}
          <strong>
            {snapshot.legal_name}
            {snapshot.preferred_name ? ` (${snapshot.preferred_name})` : ''}
          </strong>
          , employee number <strong>{snapshot.employee_number}</strong>, has an
          employment record with MAI Corp/Troll City.
        </p>

        <table className="mt-6 w-full border-collapse text-left">
          <tbody>
            <LetterRow label="Job title" value={snapshot.job_title} />
            <LetterRow
              label="Department"
              value={snapshot.department || 'Not assigned'}
            />
            <LetterRow
              label="Classification"
              value={formatLabel(snapshot.employment_classification)}
            />
            <LetterRow
              label="Employment type"
              value={formatLabel(snapshot.employment_type)}
            />
            <LetterRow
              label="Current status"
              value={formatLabel(snapshot.employment_status)}
            />
            <LetterRow
              label="Original start date"
              value={formatDate(snapshot.start_date)}
            />

            {snapshot.pay_type && (
              <LetterRow
                label="Pay type"
                value={formatLabel(snapshot.pay_type)}
              />
            )}

            {snapshot.hourly_rate !== null && (
              <LetterRow
                label="Hourly rate"
                value={`${formatCurrency(snapshot.hourly_rate)} per hour`}
              />
            )}

            {snapshot.annual_salary !== null && (
              <LetterRow
                label="Annual salary"
                value={formatCurrency(snapshot.annual_salary) || ''}
              />
            )}

            {snapshot.average_hours !== null && (
              <LetterRow
                label="Average completed shift"
                value={`${snapshot.average_hours} hours`}
              />
            )}
          </tbody>
        </table>

        {purpose.trim() && (
          <p className="mt-6">
            This verification was requested for the following purpose:{' '}
            <strong>{purpose.trim()}</strong>.
          </p>
        )}

        <p className="mt-6">
          This document verifies information contained in the Troll City
          employee records system as of the generated date. It does not
          guarantee continued employment or future compensation.
        </p>
      </div>

      <footer className="mt-12 border-t border-gray-300 pt-5 text-xs text-gray-600">
        <p>
          <strong>Verification number:</strong>{' '}
          {verification.verification_code}
        </p>

        <p>
          <strong>Valid through:</strong>{' '}
          {new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }).format(new Date(verification.expires_at))}
        </p>

        {verifyUrl && (
          <p className="mt-2 break-all">
            <strong>Public verification URL:</strong> {verifyUrl}
          </p>
        )}

        <p className="mt-3">
          This document was electronically generated from the official employee
          record system.
        </p>
      </footer>
    </article>
  )
}

function LetterRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <tr>
      <th className="w-1/3 border border-gray-300 bg-gray-100 px-3 py-2 font-bold">
        {label}
      </th>

      <td className="border border-gray-300 px-3 py-2">{value}</td>
    </tr>
  )
}
