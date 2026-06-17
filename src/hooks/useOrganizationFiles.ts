import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { validateFile, FILE_VALIDATION } from '@/lib/fileValidation'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface OrganizationFileRecord {
  id: string
  org_id: string
  uploaded_by: string | null
  folder: string
  file_name: string
  file_path: string
  file_type?: string | null
  file_size?: number | null
  access_level: 'admin_only' | 'org_admin' | 'org_staff'
  version: number
  description?: string | null
  created_at: string
  deleted_at?: string | null
}

export const ORG_FILE_FOLDERS = [
  'General',
  'MAI Class',
  'Student Reports',
  'Curriculum',
  'Assignments',
  'Legal',
  'Internal Docs',
]

const cleanSegment = (value: string) => value.replace(/[^a-zA-Z0-9._ -]/g, '').replace(/\s+/g, '-')

export function useOrganizationFiles(orgId?: string | null) {
  const { profile } = useAuthStore() as any
  const [files, setFiles] = useState<OrganizationFileRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadFiles = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_files')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      setFiles((data || []) as OrganizationFileRecord[])
    } catch (err: any) {
      console.error('[useOrganizationFiles]', err)
      toast.error(err?.message || 'Failed to load organization files')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const uploadFile = async (
    file: File,
    folder = 'General',
    accessLevel: OrganizationFileRecord['access_level'] = 'org_staff',
    description = ''
  ) => {
    if (!orgId || !profile?.id) return false

    const validation = validateFile(file, [...FILE_VALIDATION.image.types, ...FILE_VALIDATION.audio.types, ...FILE_VALIDATION.pdf.types, 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'], 50 * 1024 * 1024, 'File')
    if (!validation.valid) {
      toast.error(validation.error!)
      return false
    }

    setUploading(true)
    try {
      const safeFolder = cleanSegment(folder || 'General')
      const safeName = cleanSegment(file.name)
      const path = `${orgId}/${safeFolder}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('org-files').upload(path, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('organization_files')
        .insert({
          org_id: orgId,
          uploaded_by: profile.id,
          folder,
          file_name: file.name,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size,
          access_level: accessLevel,
          description: description || null,
        })
        .select('id')
        .single()
      if (error) throw error

      await supabase.rpc('record_organization_audit', {
        p_org_id: orgId,
        p_action: 'file_uploaded',
        p_target_type: 'organization_file',
        p_target_id: data.id,
        p_metadata: { folder, file_name: file.name, access_level: accessLevel },
      })
      toast.success('File uploaded')
      await loadFiles()
      return true
    } catch (err: any) {
      console.error('[upload org file]', err)
      toast.error(err?.message || 'Upload failed')
      return false
    } finally {
      setUploading(false)
    }
  }

  const downloadFile = async (record: OrganizationFileRecord) => {
    const { data, error } = await supabase.storage.from('org-files').createSignedUrl(record.file_path, 60)
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Download failed')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const softDeleteFile = async (record: OrganizationFileRecord) => {
    const { error } = await supabase
      .from('organization_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', record.id)
      .eq('org_id', record.org_id)
    if (error) {
      toast.error(error.message)
      return
    }
    await supabase.rpc('record_organization_audit', {
      p_org_id: record.org_id,
      p_action: 'file_deleted',
      p_target_type: 'organization_file',
      p_target_id: record.id,
      p_metadata: { file_name: record.file_name },
    })
    toast.success('File removed')
    await loadFiles()
  }

  return { files, loading, uploading, uploadFile, downloadFile, softDeleteFile, reload: loadFiles }
}
