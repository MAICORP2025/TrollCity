import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'


export default function XtrollzApplyPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    legal_first_name: '',
    legal_last_name: '',
    date_of_birth: '',
    country: '',
    state_province: '',
    id_front_file: null as File | null,
    id_back_file: null as File | null,
    selfie_file: null as File | null,
    xtrollz_role: 'streamer' as 'streamer' | 'viewer',
    accept_rules: false,
    accept_identity_consent: false,
    accept_age_agreement: false,
    accept_fee_acknowledgment: false,
  })

  useEffect(() => {
    if (!user?.id) return

    const loadApplication = async () => {
      const { data } = await supabase
        .from('xtrollz_applications')
        .select('status, legal_first_name, legal_last_name, date_of_birth, country, state_province, xtrollz_role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setForm((prev) => ({
          ...prev,
          legal_first_name: data.legal_first_name || '',
          legal_last_name: data.legal_last_name || '',
          date_of_birth: data.date_of_birth || '',
          country: data.country || '',
          state_province: data.state_province || '',
          xtrollz_role: data.xtrollz_role === 'viewer' ? 'viewer' : 'streamer',
        }))
      }
    }

    void loadApplication()
  }, [user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      setError('You must be signed in to apply.')
      return
    }

    if (!form.accept_rules || !form.accept_identity_consent || !form.accept_age_agreement || !form.accept_fee_acknowledgment) {
      setError('You must accept all agreements to continue.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const applicationId = crypto.randomUUID()

      const uploadDocument = async (file: File | null, docType: string): Promise<string | null> => {
        if (!file) return null

        const filePath = `xtrollz/${user.id}/${applicationId}/${docType}_${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('xtrollz-documents')
          .upload(filePath, file)

        if (uploadError) {
          console.warn('[XTrollzApply] upload error:', uploadError)
          return null
        }

        const { error: docError } = await supabase
          .from('xtrollz_application_documents')
          .insert({
            application_id: applicationId,
            user_id: user.id,
            document_type: docType,
            storage_path: filePath,
            mime_type: file.type,
            file_size: file.size,
          })
          .select('id')
          .single()

        if (docError) {
          console.warn('[XTrollzApply] document record error:', docError)
        }

        return filePath
      }

      const [idFrontPath, idBackPath, selfiePath] = await Promise.all([
        uploadDocument(form.id_front_file, 'id_front'),
        uploadDocument(form.id_back_file, 'id_back'),
        uploadDocument(form.selfie_file, 'selfie'),
      ])

      const { error: insertError } = await supabase.from('xtrollz_applications').insert({
        id: applicationId,
        user_id: user.id,
        legal_first_name: form.legal_first_name,
        legal_last_name: form.legal_last_name,
        date_of_birth: form.date_of_birth,
        troll_city_username: profile?.username || user.email || '',
        troll_city_user_id: user.id,
        email: user.email || '',
        country: form.country,
        state_province: form.state_province,
        id_front_url: idFrontPath,
        id_back_url: idBackPath,
        selfie_url: selfiePath,
        xtrollz_role: form.xtrollz_role,
        status: 'payment_pending',
        payment_status: 'pending',
        rules_version_accepted: '1.0',
        age_agreement_version: '1.0',
      })

      if (insertError) throw insertError

      useAuthStore.getState().setXtrollzDobMismatch(false)
      navigate('/xtrollz/payment', { state: { applicationId } })
    } catch (e) {
      setError('Failed to submit application. Please try again.')
      console.warn('[XTrollzApply] submit error:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
        <div className="mx-auto max-w-4xl p-4">
          <button
            type="button"
            onClick={() => navigate('/xtrollz')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <p className="mt-6 text-sm text-white/60">Please sign in to apply for XTrollz.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl p-4">
        <button
          type="button"
          onClick={() => navigate('/xtrollz')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-300/20 bg-pink-500/10">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">XTrollz Application</h1>
              <p className="text-xs text-white/60">Step 1 of 2 — Application and ID verification</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Legal first name</label>
                <input
                  type="text"
                  required
                  value={form.legal_first_name}
                  onChange={(e) => updateField('legal_first_name', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Legal last name</label>
                <input
                  type="text"
                  required
                  value={form.legal_last_name}
                  onChange={(e) => updateField('legal_last_name', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Date of birth</label>
                <input
                  type="date"
                  required
                  value={form.date_of_birth}
                  onChange={(e) => updateField('date_of_birth', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Country</label>
                <input
                  type="text"
                  required
                  value={form.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">State / Province</label>
                <input
                  type="text"
                  required
                  value={form.state_province}
                  onChange={(e) => updateField('state_province', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Front of government ID</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => updateField('id_front_file', e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-pink-600 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white hover:file:bg-pink-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Back of government ID (if applicable)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => updateField('id_back_file', e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-pink-600 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white hover:file:bg-pink-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Selfie / identity verification image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => updateField('selfie_file', e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-pink-600 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white hover:file:bg-pink-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black text-white/60">SELECT YOUR XTROLLZ ROLE</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${form.xtrollz_role === 'streamer' ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <input
                    type="radio"
                    name="xtrollz_role"
                    value="streamer"
                    checked={form.xtrollz_role === 'streamer'}
                    onChange={() => updateField('xtrollz_role', 'streamer')}
                    className="h-4 w-4 rounded border-white/20 bg-black/30 text-pink-600 focus:ring-pink-500"
                  />
                  <div>
                    <p className="text-sm font-black text-white">XTrollerz</p>
                    <p className="text-xs text-white/60">Streamer — can create and host streams</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${form.xtrollz_role === 'viewer' ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <input
                    type="radio"
                    name="xtrollz_role"
                    value="viewer"
                    checked={form.xtrollz_role === 'viewer'}
                    onChange={() => updateField('xtrollz_role', 'viewer')}
                    className="h-4 w-4 rounded border-white/20 bg-black/30 text-pink-600 focus:ring-pink-500"
                  />
                  <div>
                    <p className="text-sm font-black text-white">XViewer</p>
                    <p className="text-xs text-white/60">Viewer — watch streams only</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={form.accept_rules}
                  onChange={(e) => updateField('accept_rules', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-pink-600 focus:ring-pink-500"
                />
                I accept the XTrollz Rules & Guidelines.
              </label>
              <label className="flex items-start gap-3 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={form.accept_identity_consent}
                  onChange={(e) => updateField('accept_identity_consent', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-pink-600 focus:ring-pink-500"
                />
                I consent to identity verification.
              </label>
              <label className="flex items-start gap-3 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={form.accept_age_agreement}
                  onChange={(e) => updateField('accept_age_agreement', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-pink-600 focus:ring-pink-500"
                />
                I confirm I am at least 21 years old.
              </label>
              <label className="flex items-start gap-3 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={form.accept_fee_acknowledgment}
                  onChange={(e) => updateField('accept_fee_acknowledgment', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-pink-600 focus:ring-pink-500"
                />
                I understand the application fee does not guarantee approval. Streamers pay 1,000 TC and viewers pay 800 TC for 6-month access.
              </label>
            </div>

            {error ? <p className="text-xs text-white/60">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-pink-600 px-4 py-3 text-sm font-black text-white hover:bg-pink-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Continue to Payment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
