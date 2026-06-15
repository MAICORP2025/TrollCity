import { supabase } from '@/lib/supabase'
import type {
  OfficeDocument,
  OfficeDocumentVersion,
  OfficeFileListItem,
  OfficeFilePermission,
  OfficeFileType,
  OfficeFolder,
  OfficeSharedFile,
  OfficeSpreadsheet,
  OfficeSpreadsheetCell,
  OfficeTemplate,
} from '@/types/office'

function parseCellIndex(ref: string): { rowIndex: number; colIndex: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) return { rowIndex: 0, colIndex: 0 }
  const colStr = match[1]
  let colIndex = 0
  for (let i = 0; i < colStr.length; i++) {
    colIndex = colIndex * 26 + (colStr.charCodeAt(i) - 64)
  }
  return { rowIndex: parseInt(match[2], 10) - 1, colIndex: colIndex - 1 }
}

export async function fetchOfficeFolders(ownerId: string): Promise<OfficeFolder[]> {
  const { data, error } = await supabase
    .from('office_folders')
    .select('*')
    .eq('owner_id', ownerId)
    .is('parent_folder_id', null)
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []) as OfficeFolder[]
}

export async function createOfficeFolder(ownerId: string, name: string, parentFolderId?: string | null) {
  const { data, error } = await supabase
    .from('office_folders')
    .insert({ owner_id: ownerId, name: name.trim(), parent_folder_id: parentFolderId || null })
    .select()
    .single()

  if (error) throw error
  return data as OfficeFolder
}

export async function updateOfficeFolder(folderId: string, name: string) {
  const { data, error } = await supabase
    .from('office_folders')
    .update({ name: name.trim() })
    .eq('id', folderId)
    .select()
    .single()

  if (error) throw error
  return data as OfficeFolder
}

export async function deleteOfficeFolder(folderId: string) {
  const { error } = await supabase.from('office_folders').delete().eq('id', folderId)
  if (error) throw error
}

export async function fetchOfficeDocuments(ownerId: string, folderId?: string | null): Promise<OfficeDocument[]> {
  let query = supabase
    .from('office_documents')
    .select('*, folder:office_folders(*)')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })

  if (folderId) query = query.eq('folder_id', folderId)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as OfficeDocument[]
}

export async function createOfficeDocument(params: {
  ownerId: string
  title: string
  content?: string
  folderId?: string | null
  isAdminDocument?: boolean
  isReadOnly?: boolean
}) {
  const { data, error } = await supabase
    .from('office_documents')
    .insert({
      owner_id: params.ownerId,
      title: params.title.trim() || 'Untitled Document',
      content: params.content || '',
      folder_id: params.folderId || null,
      is_admin_document: params.isAdminDocument || false,
      is_read_only: params.isReadOnly || false,
    })
    .select('*, folder:office_folders(*)')
    .single()

  if (error) throw error
  return data as OfficeDocument
}

export async function updateOfficeDocument(documentId: string, patch: Partial<OfficeDocument>) {
  const { data, error } = await supabase
    .from('office_documents')
    .update({
      title: patch.title,
      content: patch.content,
      folder_id: patch.folder_id,
      is_admin_document: patch.is_admin_document,
      is_read_only: patch.is_read_only,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select('*, folder:office_folders(*)')
    .single()

  if (error) throw error
  return data as OfficeDocument
}

export async function duplicateOfficeDocument(documentId: string, newOwnerId: string) {
  const { data: source, error: sourceError } = await supabase
    .from('office_documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (sourceError) throw sourceError

  const { data, error } = await supabase
    .from('office_documents')
    .insert({
      owner_id: newOwnerId,
      title: `${source.title} (Copy)`,
      content: source.content,
      folder_id: null,
      is_admin_document: false,
      is_read_only: false,
    })
    .select('*, folder:office_folders(*)')
    .single()

  if (error) throw error
  return data as OfficeDocument
}

export async function deleteOfficeDocument(documentId: string) {
  const { error } = await supabase.from('office_documents').delete().eq('id', documentId)
  if (error) throw error
}

export async function moveOfficeDocument(documentId: string, folderId: string | null) {
  return updateOfficeDocument(documentId, { folder_id: folderId })
}

export async function createDocumentVersion(documentId: string, content: string) {
  const { data: versions, error: versionsError } = await supabase
    .from('office_document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)

  if (versionsError) throw versionsError
  const nextVersion = (versions?.[0]?.version_number || 0) + 1

  const { data, error } = await supabase
    .from('office_document_versions')
    .insert({ document_id: documentId, version_number: nextVersion, content })
    .select()
    .single()

  if (error) throw error
  return data as OfficeDocumentVersion
}

export async function fetchDocumentVersions(documentId: string): Promise<OfficeDocumentVersion[]> {
  const { data, error } = await supabase
    .from('office_document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })

  if (error) throw error
  return (data || []) as OfficeDocumentVersion[]
}

export async function restoreDocumentVersion(documentId: string, versionId: string) {
  const { data, error } = await supabase
    .from('office_document_versions')
    .select('content')
    .eq('id', versionId)
    .eq('document_id', documentId)
    .single()

  if (error) throw error
  return updateOfficeDocument(documentId, { content: data.content })
}

export async function fetchOfficeSpreadsheets(ownerId: string, folderId?: string | null): Promise<OfficeSpreadsheet[]> {
  let query = supabase
    .from('office_spreadsheets')
    .select('*, folder:office_folders(*)')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })

  if (folderId) query = query.eq('folder_id', folderId)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as OfficeSpreadsheet[]
}

export async function createOfficeSpreadsheet(params: {
  ownerId: string
  title: string
  folderId?: string | null
  initialData?: Record<string, any>
}) {
  const { data: spreadsheet, error: spreadsheetError } = await supabase
    .from('office_spreadsheets')
    .insert({
      owner_id: params.ownerId,
      title: params.title.trim() || 'Untitled Spreadsheet',
      folder_id: params.folderId || null,
    })
    .select('*, folder:office_folders(*)')
    .single()

  if (spreadsheetError) throw spreadsheetError

  if (params.initialData) {
    const cells = Object.entries(params.initialData).map(([cellReference, value]) => {
      const { rowIndex, colIndex } = parseCellIndex(cellReference)
      return {
        spreadsheet_id: spreadsheet.id,
        sheet_name: 'Sheet 1',
        cell_reference: cellReference,
        row_index: rowIndex,
        col_index: colIndex,
        value: String(value),
        formula: null,
        style_json: {},
      }
    })

    if (cells.length > 0) {
      const { error: cellsError } = await supabase.from('office_spreadsheet_cells').insert(cells)
      if (cellsError) throw cellsError
    }
  }

  return spreadsheet as OfficeSpreadsheet
}

export async function updateOfficeSpreadsheetTitle(spreadsheetId: string, title: string) {
  const { data, error } = await supabase
    .from('office_spreadsheets')
    .update({ title: title.trim() || 'Untitled Spreadsheet', updated_at: new Date().toISOString() })
    .eq('id', spreadsheetId)
    .select('*, folder:office_folders(*)')
    .single()

  if (error) throw error
  return data as OfficeSpreadsheet
}

export async function moveOfficeSpreadsheet(spreadsheetId: string, folderId: string | null) {
  const { data, error } = await supabase
    .from('office_spreadsheets')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .eq('id', spreadsheetId)
    .select('*, folder:office_folders(*)')
    .single()

  if (error) throw error
  return data as OfficeSpreadsheet
}

export async function deleteOfficeSpreadsheet(spreadsheetId: string) {
  const { error } = await supabase.from('office_spreadsheets').delete().eq('id', spreadsheetId)
  if (error) throw error
}

export async function duplicateOfficeSpreadsheet(spreadsheetId: string, newOwnerId: string) {
  const { data: source, error: sourceError } = await supabase
    .from('office_spreadsheets')
    .select('*')
    .eq('id', spreadsheetId)
    .single()

  if (sourceError) throw sourceError

  const { data: spreadsheet, error: spreadsheetError } = await supabase
    .from('office_spreadsheets')
    .insert({
      owner_id: newOwnerId,
      title: `${source.title} (Copy)`,
      folder_id: null,
    })
    .select('*, folder:office_folders(*)')
    .single()

  if (spreadsheetError) throw spreadsheetError

  const { data: cells, error: cellsError } = await supabase
    .from('office_spreadsheet_cells')
    .select('*')
    .eq('spreadsheet_id', spreadsheetId)

  if (cellsError) throw cellsError

  if (cells && cells.length > 0) {
    const { error: insertError } = await supabase.from('office_spreadsheet_cells').insert(
      cells.map((cell) => {
        const { rowIndex, colIndex } = parseCellIndex(cell.cell_reference)
        return {
          spreadsheet_id: spreadsheet.id,
          sheet_name: cell.sheet_name,
          cell_reference: cell.cell_reference,
          row_index: cell.row_index ?? rowIndex,
          col_index: cell.col_index ?? colIndex,
          value: cell.value,
          formula: cell.formula,
          style_json: cell.style_json,
        }
      }),
    )
    if (insertError) throw insertError
  }

  return spreadsheet as OfficeSpreadsheet
}

export async function fetchSpreadsheetCells(spreadsheetId: string): Promise<OfficeSpreadsheetCell[]> {
  const { data, error } = await supabase
    .from('office_spreadsheet_cells')
    .select('*')
    .eq('spreadsheet_id', spreadsheetId)

  if (error) throw error
  return (data || []) as OfficeSpreadsheetCell[]
}

export async function saveSpreadsheetCells(spreadsheetId: string, cells: OfficeSpreadsheetCell[]) {
  const cleanCells = cells.map((cell) => {
    const { rowIndex, colIndex } = parseCellIndex(cell.cell_reference)
    return {
      spreadsheet_id: spreadsheetId,
      sheet_name: cell.sheet_name,
      cell_reference: cell.cell_reference,
      row_index: cell.row_index ?? rowIndex,
      col_index: cell.col_index ?? colIndex,
      value: cell.value ?? null,
      formula: cell.formula ?? null,
      style_json: cell.style_json ?? {},
    }
  })

  if (cleanCells.length === 0) return

  const { error: deleteError } = await supabase.from('office_spreadsheet_cells').delete().eq('spreadsheet_id', spreadsheetId)
  if (deleteError) throw deleteError

  const { error } = await supabase.from('office_spreadsheet_cells').insert(cleanCells)
  if (error) throw error

  await supabase
    .from('office_spreadsheets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', spreadsheetId)
}

export async function fetchSharedWithMe(userId: string): Promise<OfficeSharedFile[]> {
  const { data, error } = await supabase
    .from('office_shared_files')
    .select('*')
    .eq('shared_with_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const shares = (data || []) as OfficeSharedFile[]
  const documentIds = shares.filter((share) => share.file_type === 'document').map((share) => share.file_id)
  const spreadsheetIds = shares.filter((share) => share.file_type === 'spreadsheet').map((share) => share.file_id)
  const ownerIds = [...new Set(shares.map((share) => share.owner_id))]

  const [documents, spreadsheets, owners] = await Promise.all([
    documentIds.length
      ? supabase.from('office_documents').select('id, title, is_admin_document, is_read_only').in('id', documentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    spreadsheetIds.length
      ? supabase.from('office_spreadsheets').select('id, title').in('id', spreadsheetIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    ownerIds.length
      ? supabase.from('user_profiles').select('id, username, display_name, role').in('id', ownerIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  if (documents.error) throw documents.error
  if (spreadsheets.error) throw spreadsheets.error
  if (owners.error) throw owners.error

  const documentById = new Map((documents.data || []).map((document: any) => [document.id, document]))
  const spreadsheetById = new Map((spreadsheets.data || []).map((spreadsheet: any) => [spreadsheet.id, spreadsheet]))
  const ownerById = new Map((owners.data || []).map((owner: any) => [owner.id, owner]))

  return shares
    .filter((share) => documentById.has(share.file_id) || spreadsheetById.has(share.file_id))
    .map((share) => ({
      ...share,
      document: share.file_type === 'document' ? documentById.get(share.file_id) : null,
      spreadsheet: share.file_type === 'spreadsheet' ? spreadsheetById.get(share.file_id) : null,
      owner: ownerById.get(share.owner_id) || null,
    }))
}

export async function shareOfficeFilesWithUsers(params: {
  files: Array<{ file_id: string; file_type: OfficeFileType; owner_id: string; is_admin_document?: boolean }>
  sharedWithUserIds: string[]
  permissionLevel: OfficeFilePermission
}) {
  for (const file of params.files) {
    for (const sharedWithUserId of params.sharedWithUserIds) {
      if (sharedWithUserId === file.owner_id) continue

      const permissionLevel = file.is_admin_document ? 'viewer' : params.permissionLevel
      const payload = {
        file_id: file.file_id,
        file_type: file.file_type,
        owner_id: file.owner_id,
        shared_with_user_id: sharedWithUserId,
        permission_level: permissionLevel,
      }

      const { error } = await supabase.from('office_shared_files').upsert(payload, {
        onConflict: 'file_id,file_type,shared_with_user_id',
      })

      if (error) throw error
    }
  }
}

export async function copySharedFileToAccount(params: {
  sharedFile: OfficeSharedFile
  newOwnerId: string
}) {
  if (params.sharedFile.file_type === 'document') {
    return duplicateOfficeDocument(params.sharedFile.file_id, params.newOwnerId)
  }

  return duplicateOfficeSpreadsheet(params.sharedFile.file_id, params.newOwnerId)
}

export async function listUserOfficeFiles(ownerId: string): Promise<OfficeFileListItem[]> {
  const [documents, spreadsheets] = await Promise.all([
    fetchOfficeDocuments(ownerId),
    fetchOfficeSpreadsheets(ownerId),
  ])

  const documentItems: OfficeFileListItem[] = documents.map((document) => ({
    id: document.id,
    title: document.title,
    file_type: 'document' as OfficeFileType,
    owner_id: document.owner_id,
    folder_id: document.folder_id,
    permission_level: 'owner' as OfficeFilePermission,
    is_admin_document: document.is_admin_document,
    is_read_only: document.is_read_only,
    updated_at: document.updated_at,
    created_at: document.created_at,
    folder: document.folder || undefined,
  }))

  const spreadsheetItems: OfficeFileListItem[] = spreadsheets.map((spreadsheet) => ({
    id: spreadsheet.id,
    title: spreadsheet.title,
    file_type: 'spreadsheet' as OfficeFileType,
    owner_id: spreadsheet.owner_id,
    folder_id: spreadsheet.folder_id,
    permission_level: 'owner' as OfficeFilePermission,
    updated_at: spreadsheet.updated_at,
    created_at: spreadsheet.created_at,
    folder: spreadsheet.folder || undefined,
  }))

  return [...documentItems, ...spreadsheetItems].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function getOfficeFileById(fileId: string, fileType: OfficeFileType) {
  if (fileType === 'document') {
    const { data, error } = await supabase.from('office_documents').select('*').eq('id', fileId).single()
    if (error) throw error
    return data as OfficeDocument
  }

  const { data, error } = await supabase.from('office_spreadsheets').select('*').eq('id', fileId).single()
  if (error) throw error
  return data as OfficeSpreadsheet
}

export async function fetchOfficeTemplates(fileType?: OfficeFileType): Promise<OfficeTemplate[]> {
  let query = supabase.from('office_templates').select('*').eq('is_public', true).order('created_at', { ascending: false })
  if (fileType) query = query.eq('file_type', fileType)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as OfficeTemplate[]
}

export async function createOfficeTemplate(params: {
  title: string
  fileType: OfficeFileType
  description?: string | null
  contentJson: Record<string, any>
}) {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Authentication required')

  const { data: template, error: templateError } = await supabase
    .from('office_templates')
    .insert({
      title: params.title.trim() || 'Untitled Template',
      file_type: params.fileType,
      description: params.description || null,
      content_json: params.contentJson,
      is_public: true,
      created_by: data.user.id,
    })
    .select()
    .single()

  if (templateError) throw templateError
  return template as OfficeTemplate
}
