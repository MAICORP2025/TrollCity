import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const MODULES = [
  'Role',
  'Policies',
  'Handbook',
  'Insurance',
  'Payroll',
  'Friday Payroll',
  'Employee Expectations',
  'Moderation Policies',
  'Role-Specific',
  'Equipment Verification',
]

const ATTESTATION =
  'I certify that I have completed the 2-week, 1-hour-daily role training plan covering all required modules, and that my trainer has verified my completion. This electronic signature is legally binding.'

export default function RoleTrainingForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Employee name', value: d.employeeName ?? '' },
        { label: 'Training plan', value: '2 weeks, 1hr daily — 10 modules' },
        { label: 'Modules completed', value: MODULES.filter((m) => d.modules?.[m]).join(', ') || 'None' },
        { label: 'Trainer name', value: d.trainerName ?? '' },
        { label: 'Completion certified', value: d.certified ? 'Yes' : 'No' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => {
        const modules = data.modules ?? {}
        const toggle = (m: string) => setField('modules', { ...modules, [m]: !modules[m] })
        return (
          <div className="space-y-4">
            <Field label="Employee full name" value={data.employeeName} onChange={(v) => setField('employeeName', v)} />
            <div>
              <p className="text-xs font-bold text-slate-300">Training plan — 2 weeks, 1 hour daily</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={!!modules[m]} onChange={() => toggle(m)} className="h-4 w-4" />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Trainer name (sign-off)" value={data.trainerName} onChange={(v) => setField('trainerName', v)} />
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={!!data.certified}
                onChange={(e) => setField('certified', e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              I certify completion of all required training modules.
            </label>
          </div>
        )
      }}
    </DocumentFormShell>
  )
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
      />
    </div>
  )
}
