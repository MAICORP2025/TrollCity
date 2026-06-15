import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import DOMPurify from 'dompurify'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link,
  Image,
  Table as TableIcon,
  Save,
  History,
  Upload,
  Copy,
  Share2,
  FolderInput,
  Trash2,
  X,
  Eye,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createDocumentVersion,
  createOfficeDocument,
  deleteOfficeDocument,
  duplicateOfficeDocument,
  fetchDocumentVersions,
  moveOfficeDocument,
  restoreDocumentVersion,
  updateOfficeDocument,
} from '@/services/officeService'
import type { OfficeDocument, OfficeDocumentVersion, OfficeFolder, OfficeFilePermission } from '@/types/office'

interface DocumentEditorProps {
  user: { id: string }
  profile: any
  officeDocument?: OfficeDocument | null
  folders: OfficeFolder[]
  permissionLevel: OfficeFilePermission
  onBack: () => void
  onRefresh: () => void
  onOpenShare: (fileId: string, fileType: 'document', permissionLevel: OfficeFilePermission) => void
}

const toolbarClass = 'inline-flex h-8 min-w-8 items-center justify-center rounded border border-cyan-500/20 bg-slate-900 px-2 text-xs text-slate-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40'
const editorDirectionStyle: React.CSSProperties = {
  direction: 'ltr',
  unicodeBidi: 'isolate',
  textAlign: 'left',
}

function forceEditorLtr(element: HTMLElement | null) {
  if (!element) return
  element.dir = 'ltr'
  element.style.direction = 'ltr'
  element.style.unicodeBidi = 'isolate'
  element.style.textAlign = 'left'
}

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function htmlToPlainText(html: string) {
  const div = document.createElement('div')
  div.innerHTML = DOMPurify.sanitize(html || '')
  return div.innerText || ''
}

function buildDocxHtml(title: string, html: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`
}

export default function DocumentEditor({
  user,
  profile,
  officeDocument,
  folders,
  permissionLevel,
  onBack,
  onRefresh,
  onOpenShare,
}: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | null>(null)
  const [title, setTitle] = useState(officeDocument?.title || 'Untitled Document')
  const [content, setContent] = useState(officeDocument?.content || '')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(officeDocument?.folder_id || '')
  const [versions, setVersions] = useState<OfficeDocumentVersion[]>([])
  const [showVersions, setShowVersions] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importName, setImportName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  const canEdit = useMemo(() => {
    const isAdmin = profile?.is_admin || profile?.role === 'admin' || profile?.troll_role === 'admin'
    return permissionLevel === 'owner' || (permissionLevel === 'editor' && !officeDocument?.is_admin_document && !officeDocument?.is_read_only) || isAdmin
  }, [permissionLevel, officeDocument?.is_admin_document, officeDocument?.is_read_only, profile])

  const cleanContent = useMemo(() => DOMPurify.sanitize(content || ''), [content])

  const execute = useCallback((command: string, value?: string) => {
    if (!canEdit) return
    document.execCommand(command, false, value)
    forceEditorLtr(editorRef.current)
    const html = editorRef.current?.innerHTML || ''
    setContent(html)
    setIsDirty(true)
  }, [canEdit])

  const insertLink = () => {
    const url = window.prompt('Paste link URL')
    if (!url) return
    execute('createLink', url)
  }

  const insertImage = () => {
    const url = window.prompt('Paste image URL')
    if (!url) return
    execute('insertImage', url)
  }

  const insertTable = () => {
    const rows = Number(window.prompt('Rows', '3'))
    const cols = Number(window.prompt('Columns', '3'))
    if (!rows || !cols) return

    let html = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;"><tbody>'
    for (let row = 0; row < rows; row += 1) {
      html += '<tr>'
      for (let col = 0; col < cols; col += 1) {
        html += '<td style="border: 1px solid #475569; padding: 8px; min-width: 80px;">&nbsp;</td>'
      }
      html += '</tr>'
    }
    html += '</tbody></table>'
    execute('insertHTML', html)
  }

  const handleImport = async (file: File) => {
    const text = await file.text()
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension === 'html' || extension === 'htm') {
      setContent(DOMPurify.sanitize(text))
    } else if (extension === 'docx') {
      setContent(`<p>DOCX package imported: ${file.name}</p><p>Paste or edit the document content below.</p>`)
    } else {
      const safeText = text
        .split('\n')
        .map((line) => `<p>${line || '&nbsp;'}</p>`)
        .join('')
      setContent(safeText)
    }

    setImportName(file.name)
    setShowImport(false)
    setIsDirty(true)
  }

  const saveNow = useCallback(async (createVersion = false) => {
    if (!canEdit) return
    setIsSaving(true)

    try {
      if (officeDocument?.id) {
        await updateOfficeDocument(officeDocument.id, {
          title: title.trim() || 'Untitled Document',
          content: editorRef.current?.innerHTML || content,
          folder_id: selectedFolderId || null,
        })

        if (createVersion) {
          await createDocumentVersion(officeDocument.id, editorRef.current?.innerHTML || content)
          await fetchDocumentVersions(officeDocument.id).then(setVersions)
          toast.success(`Version ${versions.length + 1} saved.`)
        } else {
          toast.success('Document saved.')
        }
      } else {
        const created = await createOfficeDocument({
          ownerId: user.id,
          title: title.trim() || 'Untitled Document',
          content: editorRef.current?.innerHTML || content,
          folderId: selectedFolderId || null,
          isAdminDocument: profile?.is_admin || profile?.troll_role === 'admin',
          isReadOnly: profile?.is_admin || profile?.troll_role === 'admin',
        })
        toast.success('Document created.')
        window.history.replaceState({}, '', `/tromail/office/documents/${created.id}`)
      }

      setIsDirty(false)
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save document.')
    } finally {
      setIsSaving(false)
    }
  }, [canEdit, content, officeDocument?.id, onRefresh, profile, selectedFolderId, title, user.id, versions.length])

  useEffect(() => {
    if (!officeDocument?.id) return
    fetchDocumentVersions(officeDocument.id).then(setVersions).catch(() => undefined)
  }, [officeDocument?.id])

  useEffect(() => {
    if (!officeDocument?.id || !editorRef.current) return
    const nextContent = DOMPurify.sanitize(officeDocument.content || '')
    if (editorRef.current.innerHTML !== nextContent) {
      editorRef.current.innerHTML = nextContent
      setContent(nextContent)
    }
    forceEditorLtr(editorRef.current)
  }, [officeDocument?.id, officeDocument?.content])

  useEffect(() => {
    if (!officeDocument?.id || !canEdit || !isDirty) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveNow(false), 1500)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [canEdit, officeDocument?.id, isDirty, saveNow])

  useEffect(() => {
    if (!officeDocument?.id && editorRef.current && editorRef.current.innerHTML !== cleanContent) {
      editorRef.current.innerHTML = cleanContent
    }
    forceEditorLtr(editorRef.current)
  }, [cleanContent, officeDocument?.id])

  useEffect(() => {
    const draft = localStorage.getItem(`tromail-office-draft-${user.id}`)
    if (!officeDocument?.id && draft && !content) {
      setContent(draft)
    }
  }, [content, officeDocument?.id, user.id])

  useEffect(() => {
    if (!officeDocument?.id && canEdit) {
      localStorage.setItem(`tromail-office-draft-${user.id}`, content)
    }
  }, [canEdit, content, officeDocument?.id, user.id])

  const handleDuplicate = async () => {
    if (!officeDocument?.id) return
    try {
      await duplicateOfficeDocument(officeDocument.id, user.id)
      toast.success('Document duplicated.')
      onBack()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to duplicate document.')
    }
  }

  const handleDelete = async () => {
    if (!officeDocument?.id) return
    if (!window.confirm('Delete this document?')) return

    try {
      await deleteOfficeDocument(officeDocument.id)
      localStorage.removeItem(`tromail-office-draft-${user.id}`)
      toast.success('Document deleted.')
      onBack()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete document.')
    }
  }

  const handleMove = async () => {
    if (!officeDocument?.id) return
    try {
      await moveOfficeDocument(officeDocument.id, selectedFolderId || null)
      toast.success('Document moved.')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to move document.')
    }
  }

  const exportDocument = (format: 'docx' | 'pdf' | 'txt' | 'html') => {
    const html = editorRef.current?.innerHTML || content
    const safeTitle = title.trim() || 'Untitled Document'

    if (format === 'txt') {
      downloadFile(`${safeTitle}.txt`, htmlToPlainText(html), 'text/plain')
    }

    if (format === 'html') {
      downloadFile(`${safeTitle}.html`, buildDocxHtml(safeTitle, html), 'text/html')
    }

    if (format === 'docx') {
      downloadFile(`${safeTitle}.docx`, buildDocxHtml(safeTitle, html), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    }

    if (format === 'pdf') {
      const doc = new jsPDF()
      const lines = doc.splitTextToSize(htmlToPlainText(html), 180)
      let y = 16
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage()
          y = 16
        }
        doc.text(line, 12, y)
        y += 6
      })
      doc.save(`${safeTitle}.pdf`)
    }
  }

  const restoreVersion = async (version: OfficeDocumentVersion) => {
    if (!officeDocument?.id || !canEdit) return
    if (!window.confirm(`Restore version ${version.version_number}?`)) return

    try {
      await restoreDocumentVersion(officeDocument.id, version.id)
      toast.success('Version restored.')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore version.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white" dir="ltr">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="border border-cyan-500/20 text-cyan-200 hover:bg-cyan-500/20">
              Back
            </Button>
            <div>
              {isRenaming ? (
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full max-w-md border-cyan-500/30 bg-slate-900 text-white" />
              ) : (
                <h1 className="text-2xl font-black text-white">{title}</h1>
              )}
              <p className="text-xs text-cyan-300">
                {officeDocument?.is_admin_document ? 'Administrator Document' : canEdit ? `${permissionLevel} access` : 'Read-only document'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setIsRenaming(true)} disabled={!canEdit} className="border border-white/10 text-slate-200">
              Rename
            </Button>
            <Button variant="ghost" onClick={() => setShowImport(true)} disabled={!canEdit} className="border border-white/10 text-slate-200">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button variant="ghost" onClick={() => setShowVersions(true)} className="border border-white/10 text-slate-200">
              <History className="mr-2 h-4 w-4" /> Versions
            </Button>
            <Button variant="ghost" onClick={() => exportDocument('txt')} className="border border-white/10 text-slate-200">
              TXT
            </Button>
            <Button variant="ghost" onClick={() => exportDocument('html')} className="border border-white/10 text-slate-200">
              HTML
            </Button>
            <Button variant="ghost" onClick={() => exportDocument('pdf')} className="border border-white/10 text-slate-200">
              PDF
            </Button>
            <Button variant="ghost" onClick={() => exportDocument('docx')} className="border border-white/10 text-slate-200">
              DOCX
            </Button>
            <Button variant="ghost" onClick={() => onOpenShare(officeDocument?.id || '', 'document', permissionLevel)} disabled={!officeDocument?.id || !canEdit} className="border border-white/10 text-slate-200">
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Button onClick={() => saveNow(true)} disabled={!canEdit || isSaving} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50">
              <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-2">
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('bold')} className={toolbarClass}><Bold className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('italic')} className={toolbarClass}><Italic className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('underline')} className={toolbarClass}><Underline className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('strikeThrough')} className={toolbarClass}><Strikethrough className="h-4 w-4" /></Button>
          <select disabled={!canEdit} onChange={(e) => execute('formatBlock', e.target.value)} className={toolbarClass}>
            <option value="">Normal</option>
            <option value="H1">H1</option>
            <option value="H2">H2</option>
            <option value="H3">H3</option>
            <option value="H4">H4</option>
            <option value="H5">H5</option>
            <option value="H6">H6</option>
          </select>
          <select disabled={!canEdit} onChange={(e) => execute('fontSize', e.target.value)} className={toolbarClass}>
            <option value="3">Size</option>
            <option value="1">Small</option>
            <option value="4">Medium</option>
            <option value="6">Large</option>
            <option value="7">Huge</option>
          </select>
          <select disabled={!canEdit} onChange={(e) => execute('fontName', e.target.value)} className={toolbarClass}>
            <option value="">Font</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
          </select>
          <input disabled={!canEdit} type="color" onChange={(e) => execute('foreColor', e.target.value)} className="h-8 w-10 rounded border border-cyan-500/20 bg-slate-900" />
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('justifyLeft')} className={toolbarClass}><AlignLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('justifyCenter')} className={toolbarClass}><AlignCenter className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('justifyRight')} className={toolbarClass}><AlignRight className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('insertUnorderedList')} className={toolbarClass}><List className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('insertOrderedList')} className={toolbarClass}><ListOrdered className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={insertLink} className={toolbarClass}><Link className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={insertImage} className={toolbarClass}><Image className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={insertTable} className={toolbarClass}><TableIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => execute('insertHTML', '<div style="page-break-before: always; border-top: 1px dashed #64748b; margin: 24px 0;"></div>')} className={toolbarClass}>
            Page Break
          </Button>
          <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} disabled={!canEdit} className={toolbarClass}>
            <option value="">No folder</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <Button type="button" variant="ghost" onClick={handleMove} disabled={!officeDocument?.id || !canEdit} className={toolbarClass}><FolderInput className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" onClick={handleDuplicate} disabled={!officeDocument?.id || !canEdit} className={toolbarClass}><Copy className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" onClick={handleDelete} disabled={!officeDocument?.id || !canEdit} className="border border-red-500/20 text-red-300 hover:bg-red-500/20">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-200">Autosave enabled</span>
          {isDirty && <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-yellow-200">Unsaved changes</span>}
          {officeDocument?.is_admin_document && <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-purple-200"><Lock className="mr-1 inline h-3 w-3" /> Admin Document = Read Only</span>}
        </div>

        <div className={`min-h-[70vh] rounded-2xl border bg-white p-6 text-slate-950 shadow-[0_0_35px_rgba(34,211,238,0.08)] ${canEdit ? 'border-cyan-500/30' : 'border-purple-500/30'}`}>
          {!canEdit && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-900">
              <Lock className="h-4 w-4" />
              This document is read-only. You can view, download, print, or save a personal copy.
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable={canEdit}
            suppressContentEditableWarning
            dir="ltr"
            className="prose prose-slate max-w-none outline-none"
            style={editorDirectionStyle}
            onInput={() => {
              forceEditorLtr(editorRef.current)
              const html = editorRef.current?.innerHTML || ''
              setContent(html)
              setIsDirty(true)
            }}
          />
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Import Document</h3>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <Input type="file" accept=".docx,.txt,.html,.htm,text/html" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} className="mb-3 border-cyan-500/30 bg-slate-900 text-white" />
            {importName && <p className="text-sm text-slate-400">Imported {importName}</p>}
          </div>
        </div>
      )}

      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Version History</h3>
              <button onClick={() => setShowVersions(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {versions.length === 0 ? (
              <p className="py-8 text-center text-slate-500">No saved versions yet.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 p-3">
                    <div>
                      <p className="font-semibold text-white">Version {version.version_number}</p>
                      <p className="text-xs text-slate-400">{new Date(version.created_at).toLocaleString()}</p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => restoreVersion(version)} className="text-cyan-200 hover:bg-cyan-500/20">
                      <Eye className="mr-1 h-4 w-4" /> Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
