import { supabase } from '@/lib/supabase'
import type {
  NotaryDocument, DocumentSignature, DocumentApproval, DocumentStamp,
  DocumentAuditLog, DocumentType, NotaryStats
} from '@/types/notary'

// ============================================================
// DOCUMENT TYPES
// ============================================================
export async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from('document_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data || []
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function fetchDocuments(options: {
  status?: string
  submittedBy?: string
  assignedTo?: string
  documentType?: string
  limit?: number
  offset?: number
} = {}): Promise<{ documents: NotaryDocument[]; count: number }> {
  let query = supabase
    .from('documents')
    .select('*, document_types(name, slug)', { count: 'exact' })

  if (options.status) query = query.eq('status', options.status)
  if (options.submittedBy) query = query.eq('submitted_by', options.submittedBy)
  if (options.assignedTo) query = query.eq('assigned_to', options.assignedTo)
  if (options.documentType) query = query.eq('document_type_slug', options.documentType)

  query = query.order('created_at', { ascending: false })

  if (options.limit) {
    const offset = options.offset || 0
    query = query.range(offset, offset + options.limit - 1)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { documents: (data as NotaryDocument[]) || [], count: count || 0 }
}

export async function fetchDocumentById(id: string): Promise<NotaryDocument | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, document_types(name, slug)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as NotaryDocument | null
}

export async function fetchUserDocuments(userId: string): Promise<NotaryDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, document_types(name, slug)')
    .or(`submitted_by.eq.${userId},assigned_to.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data as NotaryDocument[]) || []
}

export async function createDocument(params: {
  title: string
  content: string
  documentTypeSlug?: string
  priority?: string
  tags?: string[]
  metadata?: Record<string, any>
  assignedTo?: string
}): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('create_document', {
    p_title: params.title,
    p_content: params.content,
    p_submitter_id: userId,
    p_document_type_slug: params.documentTypeSlug || 'custom',
    p_priority: params.priority || 'normal',
    p_tags: params.tags || [],
    p_metadata: params.metadata || {},
    p_assigned_to: params.assignedTo || null
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'document_id' in data) {
    return (data as any).document_id
  }
  throw new Error('Failed to create document')
}

// ============================================================
// SIGNATURES
// ============================================================
export async function signDocument(params: {
  documentId: string
  legalName: string
  typedSignature: string
}): Promise<{ signatureId: string; signatureHash: string }> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('sign_document', {
    p_document_id: params.documentId,
    p_user_id: userId,
    p_legal_name: params.legalName,
    p_typed_signature: params.typedSignature,
    p_ip_address: null,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  })
  if (error) throw error
  const result = data as any
  if (!result?.success) throw new Error(result?.error || 'Failed to sign document')
  return { signatureId: result.signature_id, signatureHash: result.signature_hash }
}

export async function fetchDocumentSignatures(documentId: string): Promise<DocumentSignature[]> {
  const { data, error } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('document_id', documentId)
    .order('signed_at', { ascending: false })
  if (error) throw error
  return (data as DocumentSignature[]) || []
}

// ============================================================
// APPROVALS
// ============================================================
export async function approveDocument(documentId: string, comments?: string): Promise<{
  stampId: string
  verificationCode: string
  stampHash: string
}> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('approve_document', {
    p_document_id: documentId,
    p_approver_id: userId,
    p_comments: comments || null,
    p_ip_address: null,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  })
  if (error) throw error
  const result = data as any
  if (!result?.success) throw new Error(result?.error || 'Failed to approve document')
  return { stampId: result.stamp_id, verificationCode: result.verification_code, stampHash: result.stamp_hash }
}

export async function rejectDocument(documentId: string, reason: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('reject_document', {
    p_document_id: documentId,
    p_rejecter_id: userId,
    p_reason: reason,
    p_ip_address: null,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  })
  if (error) throw error
  const result = data as any
  if (!result?.success) throw new Error(result?.error || 'Failed to reject document')
}

export async function fetchDocumentApprovals(documentId: string): Promise<DocumentApproval[]> {
  const { data, error } = await supabase
    .from('document_approvals')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as DocumentApproval[]) || []
}

// ============================================================
// STAMPS
// ============================================================
export async function fetchDocumentStamp(documentId: string): Promise<DocumentStamp | null> {
  const { data, error } = await supabase
    .from('document_stamps')
    .select('*')
    .eq('document_id', documentId)
    .eq('is_valid', true)
    .maybeSingle()
  if (error) throw error
  return data as DocumentStamp | null
}

export async function verifyStamp(verificationCode: string): Promise<any> {
  const { data, error } = await supabase.rpc('verify_stamp', {
    p_verification_code: verificationCode
  })
  if (error) throw error
  return data
}

// ============================================================
// AUDIT LOGS
// ============================================================
export async function fetchAuditLogs(documentId: string): Promise<DocumentAuditLog[]> {
  const { data, error } = await supabase
    .from('document_audit_logs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data as DocumentAuditLog[]) || []
}

export async function fetchAllAuditLogs(limit = 100): Promise<DocumentAuditLog[]> {
  const { data, error } = await supabase
    .from('document_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as DocumentAuditLog[]) || []
}

// ============================================================
// STATS
// ============================================================
export async function fetchNotaryStats(): Promise<NotaryStats> {
  const { data, error } = await supabase
    .from('documents')
    .select('status, document_type_slug')
  if (error) throw error

  const docs = data || []
  const stats: NotaryStats = {
    total: docs.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
    byType: {}
  }

  for (const doc of docs) {
    const s = (doc as any).status as string
    if (s === 'pending') stats.pending++
    else if (s === 'approved') stats.approved++
    else if (s === 'rejected') stats.rejected++
    else if (s === 'draft') stats.draft++

    const type = (doc as any).document_type_slug as string || 'unknown'
    stats.byType[type] = (stats.byType[type] || 0) + 1
  }

  return stats
}

// ============================================================
// ASSIGN
// ============================================================
export async function assignDocument(documentId: string, assignToUserId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('assign_document', {
    p_document_id: documentId,
    p_assign_to_user_id: assignToUserId,
    p_assigned_by_user_id: userId
  })
  if (error) throw error
  const result = data as any
  if (!result?.success) throw new Error(result?.error || 'Failed to assign document')
}

// ============================================================
// USER SEARCH
// ============================================================
export async function searchUserDocuments(searchTerm: string): Promise<NotaryDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, document_types(name, slug), user_profiles!documents_submitted_by_fkey(username)')
    .or(`title.ilike.%${searchTerm}%,metadata->>searchable_text.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data as NotaryDocument[]) || []
}
