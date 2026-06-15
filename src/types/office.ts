export type OfficeFilePermission = 'owner' | 'editor' | 'viewer'

export type OfficeFileType = 'document' | 'spreadsheet'

export interface OfficeFolder {
  id: string
  owner_id: string
  name: string
  parent_folder_id: string | null
  created_at: string
}

export interface OfficeDocument {
  id: string
  owner_id: string
  title: string
  content: string
  folder_id: string | null
  is_admin_document: boolean
  is_read_only: boolean
  created_at: string
  updated_at: string
  folder?: OfficeFolder | null
}

export interface OfficeDocumentVersion {
  id: string
  document_id: string
  version_number: number
  content: string
  created_at: string
}

export interface OfficeSpreadsheetCell {
  id?: string
  spreadsheet_id: string
  sheet_name: string
  cell_reference: string
  row_index?: number
  col_index?: number
  value?: string | null
  formula?: string | null
  style_json?: Record<string, any> | null
  updated_at?: string
}

export interface OfficeSpreadsheet {
  id: string
  owner_id: string
  title: string
  folder_id: string | null
  created_at: string
  updated_at: string
  folder?: OfficeFolder | null
}

export interface OfficeSharedFile {
  id: string
  file_id: string
  file_type: OfficeFileType
  owner_id: string
  shared_with_user_id: string
  permission_level: OfficeFilePermission
  created_at: string
  document?: OfficeDocument | null
  spreadsheet?: OfficeSpreadsheet | null
  owner?: {
    username?: string | null
    display_name?: string | null
    role?: string | null
  } | null
}

export interface OfficeTemplate {
  id: string
  title: string
  file_type: OfficeFileType
  description?: string | null
  content_json: Record<string, any>
  is_public: boolean
  created_by: string
  created_at: string
}

export interface OfficeFileListItem {
  id: string
  title: string
  file_type: OfficeFileType
  owner_id: string
  folder_id: string | null
  permission_level: OfficeFilePermission
  is_admin_document?: boolean
  is_read_only?: boolean
  updated_at: string
  created_at: string
  folder?: OfficeFolder | null
}
