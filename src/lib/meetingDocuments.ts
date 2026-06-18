import { supabase } from './supabase'

export interface MeetingDocument {
  id: string
  meeting_id: string
  document_id: string
  shared_by: string
  visible_to_roles: string[]
  shared_at: string
  created_at: string
}

export interface MeetingDocumentWithDetails extends MeetingDocument {
  document_title?: string
  document_type?: string
  file_url?: string
  storage_path?: string
  uploaded_by?: string
  sharer_username?: string
}

export async function shareDocumentInMeeting(params: {
  meetingId: string
  documentId: string
  sharedBy: string
  visibleToRoles?: string[]
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('meeting_documents')
      .insert({
        meeting_id: params.meetingId,
        document_id: params.documentId,
        shared_by: params.sharedBy,
        visible_to_roles: params.visibleToRoles || [],
      })

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Document already shared in this meeting' }
      }
      throw error
    }
    return { success: true }
  } catch (err: any) {
    console.error('[meetingDocuments] Failed to share:', err)
    return { success: false, error: err?.message || 'Failed to share document' }
  }
}

export async function getMeetingDocuments(meetingId: string): Promise<MeetingDocumentWithDetails[]> {
  const { data, error } = await supabase
    .from('meeting_documents')
    .select(`
      *,
      organization_documents(
        document_title,
        document_type,
        file_url,
        storage_path,
        uploaded_by
      )
    `)
    .eq('meeting_id', meetingId)
    .order('shared_at', { ascending: false })

  if (error) {
    console.error('[meetingDocuments] Failed to fetch:', error)
    return []
  }

  return (data || []).map((d: any) => ({
    ...d,
    document_title: d.organization_documents?.document_title,
    document_type: d.organization_documents?.document_type,
    file_url: d.organization_documents?.file_url,
    storage_path: d.organization_documents?.storage_path,
    uploaded_by: d.organization_documents?.uploaded_by,
  })) as MeetingDocumentWithDetails[]
}

export async function removeMeetingDocument(meetingDocId: string): Promise<boolean> {
  const { error } = await supabase
    .from('meeting_documents')
    .delete()
    .eq('id', meetingDocId)

  if (error) {
    console.error('[meetingDocuments] Failed to remove:', error)
    return false
  }
  return true
}

export async function getAvailableDocumentsForMeeting(meetingId: string): Promise<any[]> {
  const { data: meetingDocs } = await supabase
    .from('meeting_documents')
    .select('document_id')
    .eq('meeting_id', meetingId)

  const sharedIds = (meetingDocs || []).map((d: any) => d.document_id)

  const { data, error } = await supabase
    .from('organization_documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[meetingDocuments] Failed to fetch available docs:', error)
    return []
  }

  return (data || []).filter((doc: any) => !sharedIds.includes(doc.id))
}
