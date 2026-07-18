import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'
import { generateW4Pdf, type W4FormData } from '../../../../lib/taxFormPdfs'

const ATTESTATION =
  'Under penalties of perjury, I declare that this certificate, including all accompanying schedules, has been examined by me and to the best of my knowledge and belief is true, correct, and complete.'

export default function FormW4(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records. The separate Employer's Instructions and the Multiple Jobs Worksheet are not retained by the employee."
      attestation={ATTESTATION}
      onGeneratePdf={async (data, signatureName) => {
        const w4Data: W4FormData = {
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          ssn: data.ssn ?? '',
          street: data.street ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zip: data.zip ?? '',
          filingStatus: (data.filingStatus ?? 'single') as W4FormData['filingStatus'],
          exempt: !!data.exempt,
          dependentsTotal: data.dependentsTotal ?? '',
          dependentsAmount: data.dependentsAmount ?? '',
          otherIncome: data.otherIncome ?? '',
          deductions: data.deductions ?? '',
          extraWithholding: data.extraWithholding ?? '',
          signature: signatureName,
          date: new Date().toISOString().slice(0, 10),
        }
        try {
          return await generateW4Pdf(w4Data)
        } catch (err) {
          console.error('Failed to generate W-4 PDF:', err)
          return null
        }
      }}
      fieldsForPdf={(d, sig, date) => [
        { label: 'First name', value: d.firstName ?? '' },
        { label: 'Last name', value: d.lastName ?? '' },
        { label: 'SSN', value: d.ssn ?? '', sensitive: true },
        { label: 'Address', value: [d.street, d.city, d.state, d.zip].filter(Boolean).join(', ') },
        { label: 'Filing status', value: filingLabel(d.filingStatus) },
        { label: 'Step 2 (multiple jobs)', value: d.multipleJobs ? 'Yes' : 'No' },
        { label: 'Step 3 dependents total', value: d.dependentsTotal ?? '' },
        { label: 'Step 3 $ amount', value: d.dependentsAmount ?? '' },
        { label: 'Step 4a other income', value: d.otherIncome ?? '' },
        { label: 'Step 4b deductions', value: d.deductions ?? '' },
        { label: 'Step 4c extra withholding', value: d.extraWithholding ?? '' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="space-y-5">
          <StepTitle>Step 1 — Personal Information</StepTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={data.firstName} onChange={(v) => setField('firstName', v)} />
            <Field label="Last name" value={data.lastName} onChange={(v) => setField('lastName', v)} />
            <Field label="Social Security Number" value={data.ssn} onChange={(v) => setField('ssn', v)} placeholder="•••••••••" sensitive />
            <Field label="Street address" value={data.street} onChange={(v) => setField('street', v)} />
            <Field label="City" value={data.city} onChange={(v) => setField('city', v)} />
            <Field label="State" value={data.state} onChange={(v) => setField('state', v)} />
            <Field label="ZIP code" value={data.zip} onChange={(v) => setField('zip', v)} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300">Filing status</p>
            <div className="mt-2 space-y-2">
              {[
                ['single', 'Single or Married filing separately'],
                ['married', 'Married filing jointly'],
                ['hoh', 'Head of household'],
              ].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="w4status"
                    checked={data.filingStatus === val}
                    onChange={() => setField('filingStatus', val)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <StepTitle>Step 2 — Multiple Jobs or Spouse Works</StepTitle>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={!!data.multipleJobs}
              onChange={(e) => setField('multipleJobs', e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            I have more than one job, or my spouse works. (Use the Multiple Jobs Worksheet or the
            IRS Tax Withholding Estimator to estimate extra withholding — worksheet not retained.)
          </label>

          <StepTitle>Step 3 — Claim Dependents</StepTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total number of dependents" value={data.dependentsTotal} onChange={(v) => setField('dependentsTotal', v)} />
            <Field
              label="Dollar amount (qualifying children + other dependents)"
              value={data.dependentsAmount}
              onChange={(v) => setField('dependentsAmount', v)}
            />
          </div>

          <StepTitle>Step 4 — Other Adjustments (optional)</StepTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="4(a) Other income" value={data.otherIncome} onChange={(v) => setField('otherIncome', v)} placeholder="$" />
            <Field label="4(b) Deductions" value={data.deductions} onChange={(v) => setField('deductions', v)} placeholder="$" />
            <Field label="4(c) Extra withholding" value={data.extraWithholding} onChange={(v) => setField('extraWithholding', v)} placeholder="$" />
          </div>
        </div>
      )}
    </DocumentFormShell>
  )
}

function filingLabel(v?: string) {
  switch (v) {
    case 'single': return 'Single / Married filing separately'
    case 'married': return 'Married filing jointly'
    case 'hoh': return 'Head of household'
    default: return ''
  }
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-black uppercase tracking-wide text-cyan-200">{children}</h4>
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  sensitive,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  sensitive?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={sensitive ? 'password' : 'text'}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none placeholder:text-slate-600"
      />
    </div>
  )
}
