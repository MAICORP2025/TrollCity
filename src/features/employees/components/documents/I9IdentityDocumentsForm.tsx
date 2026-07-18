import React, { useState } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'
import { supabase } from '../../../../lib/supabase'

const DOCS_BUCKET = 'employee-documents'

const DOC_CHOICES = [
  'U.S. Passport',
  "Driver's License + Social Security Card",
  'Permanent Resident Card (Form I-551)',
  'Employment Authorization Document (Form I-766)',
  'State ID + Birth Certificate',
  'Other acceptable List A/B/C documents',
]

const ATTESTATION =
  'I certify that the identity and work-authorization documents I am uploading are genuine, unaltered originals or certified copies, and that I am providing acceptable documentation as required by Form I-9.'

export default function I9IdentityDocumentsForm(props: DocumentFormProps) {
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>(props.initialData?.uploads ?? [])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    const employeeId = props.employeeId
    if (!employeeId) {
      toast.error('Unable to identify your account.')
      return
    }
    setUploading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${employeeId}/i9_identity_documents-${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })
      if (error) throw error
      const { data: urlData } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path)
      const url = urlData?.publicUrl ?? path
      const next = [...uploads, { name: file.name, url }]
      setUploads(next)
      props.onSave?.({ ...props.initialData, uploads: next }, '')
      toast.success('Document uploaded.')
    } catch (err) {
      console.error('Upload failed', err)
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain your documents. HR verifies original documents at review."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Documents provided', value: (d.provided ?? []).join(', ') || 'None selected' },
        { label: 'Uploaded files', value: (d.uploads ?? []).map((u: any) => u.name).join(', ') || 'None' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-300">Documents you are providing</p>
            <div className="mt-2 space-y-2">
              {DOC_CHOICES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={!!(data.provided ?? []).includes(c)}
                    onChange={(e) =>
                      setField(
                        'provided',
                        e.target.checked
                          ? [...(data.provided ?? []), c]
                          : (data.provided ?? []).filter((x: string) => x !== c),
                      )
                    }
                    className="h-4 w-4"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-300">Upload identity documents</p>
            <label className="mt-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload file
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(f)
                  e.target.value = ''
                }}
              />
            </label>
            <ul className="mt-3 space-y-2">
              {uploads.map((u) => (
                <li key={u.url} className="flex items-center gap-2 text-xs text-slate-300">
                  <FileText className="h-4 w-4 text-cyan-300" />
                  <a href={u.url} target="_blank" rel="noreferrer" className="underline decoration-cyan-300/40">
                    {u.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-4 text-slate-400">
            Acceptable documents: one document from List A, OR one document from List B and one from
            List C. Do not provide a specific document — choose what you have.
          </p>
        </div>
      )}
    </DocumentFormShell>
  )
}
