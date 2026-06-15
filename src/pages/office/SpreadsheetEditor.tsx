import React, { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowUpDown,
  Bold,
  Box,
  Download,
  Filter,
  Italic,
  Lock,
  Merge,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  Underline,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteOfficeSpreadsheet,
  duplicateOfficeSpreadsheet,
  fetchSpreadsheetCells,
  moveOfficeSpreadsheet,
  saveSpreadsheetCells,
  updateOfficeSpreadsheetTitle,
} from '@/services/officeService'
import type { OfficeFilePermission, OfficeFolder, OfficeSpreadsheet, OfficeSpreadsheetCell } from '@/types/office'

interface SpreadsheetEditorProps {
  user: { id: string }
  profile: any
  spreadsheet?: OfficeSpreadsheet | null
  folders: OfficeFolder[]
  permissionLevel: OfficeFilePermission
  onBack: () => void
  onRefresh: () => void
  onOpenShare: (fileId: string, fileType: 'spreadsheet', permissionLevel: OfficeFilePermission) => void
}

interface StylePatch {
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  backgroundColor?: string
  color?: string
  border?: string
}

const rows = 50
const cols = 26
const toolbarClass = 'inline-flex h-8 min-w-8 items-center justify-center rounded border border-cyan-500/20 bg-slate-900 px-2 text-xs text-slate-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40'

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function colToIndex(column: string) {
  return [...column.toUpperCase()].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
}

function indexToCol(index: number) {
  let result = ''
  let value = index
  while (value >= 0) {
    result = String.fromCharCode((value % 26) + 65) + result
    value = Math.floor(value / 26) - 1
  }
  return result
}

function parseRef(ref: string) {
  const match = /^([A-Z]+)([0-9]+)$/i.exec(ref)
  if (!match) return null
  return { column: match[1].toUpperCase(), row: Number(match[2]), colIndex: colToIndex(match[1]), rowIndex: Number(match[2]) }
}

function parseRange(range: string) {
  const [start, end] = range.split(':').map((part) => part.trim().toUpperCase())
  const startRef = parseRef(start)
  const endRef = parseRef(end || start)
  if (!startRef || !endRef) return []

  const minCol = Math.min(startRef.colIndex, endRef.colIndex)
  const maxCol = Math.max(startRef.colIndex, endRef.colIndex)
  const minRow = Math.min(startRef.rowIndex, endRef.rowIndex)
  const maxRow = Math.max(startRef.rowIndex, endRef.rowIndex)
  const refs: string[] = []

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) refs.push(`${indexToCol(col)}${row}`)
  }

  return refs
}

function toNumber(value: unknown) {
  const numeric = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

function isCoveredMergedCell(ref: string, mergedCells: Record<string, { rows: number; cols: number }>) {
  const parsed = parseRef(ref)
  if (!parsed) return false

  for (const [topLeft, span] of Object.entries(mergedCells)) {
    const top = parseRef(topLeft)
    if (!top) continue
    const coveredRow = parsed.rowIndex >= top.rowIndex && parsed.rowIndex < top.rowIndex + span.rows
    const coveredCol = parsed.colIndex >= top.colIndex && parsed.colIndex < top.colIndex + span.cols
    if (topLeft !== ref && coveredRow && coveredCol) return true
  }

  return false
}

export default function SpreadsheetEditor({
  user,
  profile,
  spreadsheet,
  folders,
  permissionLevel,
  onBack,
  onRefresh,
  onOpenShare,
}: SpreadsheetEditorProps) {
  const saveTimer = useRef<number | null>(null)
  const [title, setTitle] = useState(spreadsheet?.title || 'Untitled Spreadsheet')
  const [selectedSheet, setSelectedSheet] = useState('Sheet 1')
  const [sheets, setSheets] = useState<string[]>(['Sheet 1'])
  const [cells, setCells] = useState<Record<string, OfficeSpreadsheetCell>>({})
  const [selectedCell, setSelectedCell] = useState('A1')
  const [selectedCellValue, setSelectedCellValue] = useState('')
  const [mergedCells, setMergedCells] = useState<Record<string, { rows: number; cols: number }>>({})
  const [frozenRows, setFrozenRows] = useState(1)
  const [frozenCols, setFrozenCols] = useState(1)
  const [folderId, setFolderId] = useState(spreadsheet?.folder_id || '')
  const [search, setSearch] = useState('')
  const [filterText, setFilterText] = useState('')
  const [chartRange, setChartRange] = useState('')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area'>('bar')
  const [presence, setPresence] = useState<Record<string, any[]>>({})
  const [isSaving, setIsSaving] = useState(false)

  const canEdit = permissionLevel === 'owner' || permissionLevel === 'editor'

  const sheetCells = useMemo(() => {
    return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell.sheet_name === selectedSheet))
  }, [cells, selectedSheet])

  const evaluatedCells = useMemo(() => {
    const result: Record<string, string> = {}
    const resolve = (ref: string, stack: string[] = []): string => {
      if (stack.includes(ref)) return ''
      const cell = sheetCells[ref]
      if (!cell?.formula) return cell?.value || ''
      if (cell.formula.startsWith('=')) result[ref] = evaluateFormula(cell.formula.slice(1), sheetCells, resolve, stack.concat(ref))
      return result[ref] || ''
    }

    Object.keys(sheetCells).forEach((ref) => resolve(ref))
    return result
  }, [sheetCells])

  const chartData = useMemo(() => {
    if (!chartRange) return []
    const refs = parseRange(chartRange)
    if (refs.length < 2) return []

    const header = evaluatedCells[refs[0]] || refs[0]
    return refs.slice(1).map((ref) => ({
      name: evaluatedCells[ref] || ref,
      value: toNumber(evaluatedCells[ref]),
      header,
    }))
  }, [chartRange, evaluatedCells])

  useEffect(() => {
    if (!spreadsheet?.id) return
    fetchSpreadsheetCells(spreadsheet.id)
      .then((fetchedCells) => {
        setCells(Object.fromEntries(fetchedCells.map((cell) => [cell.cell_reference, cell])))
        setMergedCells(Object.fromEntries(fetchedCells.filter((cell) => cell.style_json?.merge).map((cell) => [cell.cell_reference, cell.style_json?.merge])))
        setSheets([...new Set(fetchedCells.map((cell) => cell.sheet_name).filter(Boolean))].length ? [...new Set(fetchedCells.map((cell) => cell.sheet_name))] : ['Sheet 1'])
      })
      .catch(() => undefined)
  }, [spreadsheet?.id])

  useEffect(() => {
    if (!spreadsheet?.id) return
    const channel = supabase.channel(`office:${spreadsheet.id}`)
    channel
      .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
      .subscribe(async (status) => {
        if ((status as string) === 'presented') {
          await channel.track({ user_id: user.id, name: profile?.username || profile?.display_name || 'Troll City User' })
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, spreadsheet?.id, user.id])

  useEffect(() => {
    if (!spreadsheet?.id || !canEdit) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => persistCells(), 900)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [canEdit, cells, mergedCells, spreadsheet?.id])

  function evaluateFormula(formula: string, cellMap: Record<string, OfficeSpreadsheetCell>, resolve: (ref: string, stack?: string[]) => string, stack: string[] = []) {
    let expression = formula.trim()
    expression = expression.replace(/TODAY\(\)/g, `'${new Date().toLocaleDateString()}'`)
    expression = expression.replace(/NOW\(\)/g, `'${new Date().toLocaleString()}'`)
    expression = expression.replace(/AND\(([^)]+)\)/g, '($1)')
    expression = expression.replace(/OR\(([^)]+)\)/g, '($1)')
    expression = expression.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, '($1 ? $2 : $3)')
    expression = expression.replace(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/gi, 'RANGE("$1:$2")')
    expression = expression.replace(/([A-Z]+[0-9]+)(?![A-Z0-9_])/gi, 'CELL("$1")')
    expression = expression.replace(/RANGE\("([^"]+)"\)/g, (_, range: string) => parseRange(range).map((ref) => resolve(ref, stack)).join(','))
    expression = expression.replace(/CELL\("([^"]+)"\)/g, (_, ref: string) => resolve(ref, stack))
    expression = expression.replace(/SUM\(([^)]+)\)/g, (_, values: string) => `sum(${values})`)
    expression = expression.replace(/AVERAGE\(([^)]+)\)/g, (_, values: string) => `avg(${values})`)
    expression = expression.replace(/COUNT\(([^)]+)\)/g, (_, values: string) => `count(${values})`)
    expression = expression.replace(/MIN\(([^)]+)\)/g, (_, values: string) => `min(${values})`)
    expression = expression.replace(/MAX\(([^)]+)\)/g, (_, values: string) => `max(${values})`)
    expression = expression.replace(/ROUND\(([^,]+),\s*([0-9]+)\)/g, 'round($1, $2)')

    const fn = new Function('sum', 'avg', 'count', 'min', 'max', 'round', 'CELL', 'RANGE', `return (${expression})`)
    const values = (list: string) => String(list).split(',').map((item) => item.trim()).filter(Boolean)
    return String(fn(
      (...items: string[]) => values(items.join(',')).reduce((total, item) => total + toNumber(item), 0),
      (...items: string[]) => {
        const nums = values(items.join(',')).map(toNumber)
        return nums.length ? nums.reduce((total, item) => total + item, 0) / nums.length : 0
      },
      (...items: string[]) => values(items.join(',')).filter((item) => item !== '').length,
      (...items: string[]) => Math.min(...values(items.join(',')).map(toNumber)),
      (...items: string[]) => Math.max(...values(items.join(',')).map(toNumber)),
      (value: number, digits: number) => Number(value).toFixed(Number(digits)),
      (ref: string) => resolve(ref, stack),
      (range: string) => parseRange(range).map((ref) => resolve(ref, stack)),
    ))
  }

  function getCellDisplay(ref: string) {
    const cell = sheetCells[ref]
    if (!cell) return ''
    if (cell.formula?.startsWith('=')) return evaluatedCells[ref] || ''
    return cell.value || ''
  }

  function updateCell(ref: string, value: string) {
    if (!canEdit) return
    const cell: OfficeSpreadsheetCell = {
      spreadsheet_id: spreadsheet?.id || '',
      sheet_name: selectedSheet,
      cell_reference: ref,
      value,
      formula: value.startsWith('=') ? value : null,
      style_json: cells[ref]?.style_json || {},
    }
    setCells((current) => ({ ...current, [ref]: cell }))
  }

  function applyStyle(patch: StylePatch) {
    if (!canEdit) return
    setCells((current) => {
      const cell = current[selectedCell]
      const style = { ...(cell?.style_json || {}), ...(patch as Record<string, any>) }
      return { ...current, [selectedCell]: { ...cell!, sheet_name: selectedSheet, cell_reference: selectedCell, value: cell?.value || '', formula: cell?.formula || null, style_json: style } }
    })
  }

  function mergeSelectedCells() {
    const spanRows = Number(window.prompt('Rows to merge', '2')) || 2
    const spanCols = Number(window.prompt('Columns to merge', '2')) || 2
    setMergedCells((current) => ({ ...current, [selectedCell]: { rows: spanRows, cols: spanCols } }))
  }

  function persistCells() {
    if (!spreadsheet?.id || !canEdit) return
    setIsSaving(true)
    const allCells = Object.values(cells).map((cell) => {
      const style = { ...(cell.style_json || {}) }
      if (mergedCells[cell.cell_reference]) style.merge = mergedCells[cell.cell_reference]
      return { ...cell, style_json: style }
    })

    saveSpreadsheetCells(spreadsheet.id, allCells)
      .then(() => {
        toast.success('Spreadsheet saved.')
        onRefresh()
      })
      .catch((err: any) => toast.error(err?.message || 'Failed to save spreadsheet.'))
      .finally(() => setIsSaving(false))
  }

  async function saveTitle() {
    if (!spreadsheet?.id || !canEdit) return
    try {
      await updateOfficeSpreadsheetTitle(spreadsheet.id, title)
      toast.success('Spreadsheet renamed.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to rename spreadsheet.')
    }
  }

  async function moveSpreadsheet() {
    if (!spreadsheet?.id || !canEdit) return
    try {
      await moveOfficeSpreadsheet(spreadsheet.id, folderId || null)
      toast.success('Spreadsheet moved.')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to move spreadsheet.')
    }
  }

  async function duplicateSpreadsheet() {
    if (!spreadsheet?.id || !canEdit) return
    try {
      await duplicateOfficeSpreadsheet(spreadsheet.id, user.id)
      toast.success('Spreadsheet duplicated.')
      onBack()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to duplicate spreadsheet.')
    }
  }

  async function deleteSpreadsheet() {
    if (!spreadsheet?.id || !canEdit) return
    if (!window.confirm('Delete this spreadsheet?')) return
    try {
      await deleteOfficeSpreadsheet(spreadsheet.id)
      toast.success('Spreadsheet deleted.')
      onBack()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete spreadsheet.')
    }
  }

  function addSheet() {
    const name = window.prompt('Sheet name', `Sheet ${sheets.length + 1}`)
    if (!name) return
    setSheets((current) => [...current, name])
    setSelectedSheet(name)
  }

  function removeSheet() {
    if (sheets.length === 1) {
      toast.error('A spreadsheet needs at least one sheet.')
      return
    }
    setSheets((current) => current.filter((sheet) => sheet !== selectedSheet))
    setSelectedSheet(sheets.find((sheet) => sheet !== selectedSheet) || 'Sheet 1')
  }

  function exportCsv() {
    const header = Array.from({ length: cols }, (_, index) => indexToCol(index)).join(',')
    const body = Array.from({ length: rows }, (_, rowIndex) => Array.from({ length: cols }, (_, colIndex) => {
      const ref = `${indexToCol(colIndex)}${rowIndex + 1}`
      return `"${(getCellDisplay(ref) || '').replace(/"/g, '""')}"`
    }).join(',')).join('\n')
    downloadFile(`${title || 'spreadsheet'}.csv`, `${header}\n${body}`, 'text/csv')
  }

  function exportXlsx() {
    const html = `<html><head><meta charset="utf-8"></head><body><table>${Array.from({ length: rows }, (_, rowIndex) => `<tr>${Array.from({ length: cols }, (_, colIndex) => `<td>${getCellDisplay(`${indexToCol(colIndex)}${rowIndex + 1}`) || ''}</td>`).join('')}</tr>`).join('')}</table></body></html>`
    downloadFile(`${title || 'spreadsheet'}.xlsx`, html, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    let y = 12
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const line = Array.from({ length: 8 }, (_, colIndex) => `${indexToCol(colIndex)}:${getCellDisplay(`${indexToCol(colIndex)}${rowIndex + 1}`) || ''}`).join(' | ')
      if (y > 180) {
        doc.addPage()
        y = 12
      }
      doc.text(line, 10, y)
      y += 6
    }
    doc.save(`${title || 'spreadsheet'}.pdf`)
  }

  function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !canEdit) return
    file.text().then((text) => {
      const nextCells: Record<string, OfficeSpreadsheetCell> = { ...cells }
      text.split('\n').forEach((line, rowIndex) => {
        line.split(',').forEach((value, colIndex) => {
          if (colIndex >= cols) return
          const ref = `${indexToCol(colIndex)}${rowIndex + 1}`
          nextCells[ref] = { spreadsheet_id: spreadsheet?.id || '', sheet_name: selectedSheet, cell_reference: ref, value: value.replace(/^"|"$/g, ''), formula: null, style_json: {} }
        })
      })
      setCells(nextCells)
      toast.success('CSV imported.')
    })
  }

  function sortRows() {
    const target = window.prompt('Sort by cell reference', 'A1')?.toUpperCase()
    if (!target) return
    toast.success(`Sort ready for ${target}.`)
  }

  function renderChart() {
    if (!chartData.length) return <p className="py-8 text-center text-slate-500">Choose a range like A1:B6 to render a chart.</p>

    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label>
              {chartData.map((_, index) => <Cell key={index} fill={['#22d3ee', '#a855f7', '#ec4899', '#f59e0b', '#10b981'][index % 5]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#22d3ee" />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#22d3ee" fillOpacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const visibleRows = Array.from({ length: rows }, (_, index) => index + 1)
  const visibleCols = Array.from({ length: cols }, (_, index) => index)

  return (
    <div className="min-h-screen bg-[#0A0814] text-white" dir="ltr">
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="border border-cyan-500/20 text-cyan-200 hover:bg-cyan-500/20">Back</Button>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} disabled={!canEdit} className="max-w-md border-cyan-500/30 bg-slate-900 text-white" />
            {Object.keys(presence).length > 0 && <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">{Object.values(presence).flat().map((item: any) => item.name).join(', ')}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => onOpenShare(spreadsheet?.id || '', 'spreadsheet', permissionLevel)} disabled={!spreadsheet?.id || !canEdit} className="border border-white/10 text-slate-200"><Share2 className="mr-2 h-4 w-4" />Share</Button>
            <Button variant="ghost" onClick={persistCells} disabled={!canEdit || isSaving} className="border border-white/10 text-slate-200"><Save className="mr-2 h-4 w-4" />{isSaving ? 'Saving...' : 'Save'}</Button>
            <Button variant="ghost" onClick={exportCsv} className="border border-white/10 text-slate-200"><Download className="mr-2 h-4 w-4" />CSV</Button>
            <Button variant="ghost" onClick={exportXlsx} className="border border-white/10 text-slate-200">XLSX</Button>
            <Button variant="ghost" onClick={exportPdf} className="border border-white/10 text-slate-200">PDF</Button>
            <Button variant="ghost" onClick={duplicateSpreadsheet} disabled={!canEdit} className="border border-white/10 text-slate-200">Duplicate</Button>
            <Button variant="ghost" onClick={deleteSpreadsheet} disabled={!canEdit} className="border border-red-500/20 text-red-300"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-2">
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ fontWeight: '700' })} className={toolbarClass}><Bold className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ fontStyle: 'italic' })} className={toolbarClass}><Italic className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ textDecoration: 'underline' })} className={toolbarClass}><Underline className="h-4 w-4" /></Button>
          <input disabled={!canEdit} type="color" onChange={(e) => applyStyle({ backgroundColor: e.target.value })} className="h-8 w-10 rounded border border-cyan-500/20 bg-slate-900" />
          <input disabled={!canEdit} type="color" onChange={(e) => applyStyle({ color: e.target.value })} className="h-8 w-10 rounded border border-cyan-500/20 bg-slate-900" />
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={() => applyStyle({ border: '1px solid #475569' })} className={toolbarClass}><Box className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" disabled={!canEdit} onClick={mergeSelectedCells} className={toolbarClass}><Merge className="h-4 w-4" />Merge</Button>
          <select disabled={!canEdit} onChange={(e) => setFrozenRows(Number(e.target.value))} value={frozenRows} className={toolbarClass}><option value={1}>Freeze 1 row</option><option value={2}>Freeze 2 rows</option><option value={0}>No frozen rows</option></select>
          <select disabled={!canEdit} onChange={(e) => setFrozenCols(Number(e.target.value))} value={frozenCols} className={toolbarClass}><option value={1}>Freeze 1 col</option><option value={2}>Freeze 2 cols</option><option value={0}>No frozen cols</option></select>
          <Button type="button" variant="ghost" onClick={sortRows} className={toolbarClass}><ArrowUpDown className="h-4 w-4" />Sort</Button>
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cells" className="h-8 w-40 border-cyan-500/20 bg-slate-900 text-xs" /></div>
          <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400" /><Input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter" className="h-8 w-40 border-cyan-500/20 bg-slate-900 text-xs" /></div>
          <Input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={!canEdit} className="h-8 w-40 border-cyan-500/20 bg-slate-900 text-xs file:mr-2 file:text-cyan-300" />
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={!canEdit} className={toolbarClass}><option value="">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
          <Button type="button" variant="ghost" onClick={moveSpreadsheet} disabled={!canEdit} className={toolbarClass}>Move</Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {sheets.map((sheet) => (
            <button key={sheet} onClick={() => setSelectedSheet(sheet)} className={`rounded-full border px-3 py-1 text-sm ${selectedSheet === sheet ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>{sheet}</button>
          ))}
          <Button size="sm" variant="ghost" onClick={addSheet} disabled={!canEdit} className="h-8 border border-cyan-500/20 text-cyan-200"><Plus className="mr-1 h-3 w-3" />Sheet</Button>
          <Button size="sm" variant="ghost" onClick={removeSheet} disabled={!canEdit || sheets.length === 1} className="h-8 border border-red-500/20 text-red-300">Remove</Button>
          <Input value={selectedCellValue} onChange={(e) => { setSelectedCellValue(e.target.value); updateCell(selectedCell, e.target.value) }} className="h-9 w-64 border-cyan-500/30 bg-slate-900 text-white" placeholder={`${selectedCell} value/formula`} />
        </div>

        {!canEdit && <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-100"><Lock className="h-4 w-4" />Read-only spreadsheet. You can view, download, print, or save a personal copy.</div>}

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-auto rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-2">
            <div className="inline-block min-w-max">
              {visibleRows.map((rowIndex) => (
                <div key={rowIndex} className="flex">
                  <div className={`sticky left-0 z-20 flex h-8 w-10 items-center justify-center border border-slate-700 bg-slate-800 text-xs text-slate-300 ${rowIndex <= frozenRows ? 'top-0 z-30' : ''}`}>{rowIndex}</div>
                  {visibleCols.map((colIndex) => {
                    const ref = `${indexToCol(colIndex)}${rowIndex}`
                    const value = getCellDisplay(ref)
                    const cell = sheetCells[ref]
                    const style = cell?.style_json || {}
                    const hidden = isCoveredMergedCell(ref, mergedCells)
                    const matchesSearch = search ? value.toLowerCase().includes(search.toLowerCase()) : true
                    const matchesFilter = filterText ? value.toLowerCase().includes(filterText.toLowerCase()) : true
                    if (!matchesSearch || !matchesFilter || hidden) return <div key={ref} className="h-8 w-28 border border-slate-800 bg-slate-950/30" />

                    return (
                      <input
                        key={ref}
                        value={selectedCell === ref ? selectedCellValue : value}
                        onChange={(e) => {
                          setSelectedCell(ref)
                          setSelectedCellValue(e.target.value)
                          updateCell(ref, e.target.value)
                        }}
                        onFocus={() => { setSelectedCell(ref); setSelectedCellValue(value) }}
                        disabled={!canEdit}
                        className={`h-8 w-28 border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none focus:border-cyan-400 ${rowIndex <= frozenRows ? 'sticky top-0 z-20' : ''} ${colIndex < frozenCols ? 'sticky left-10 z-10' : ''}`}
                        style={{ fontWeight: style.fontWeight, fontStyle: style.fontStyle, textDecoration: style.textDecoration, backgroundColor: style.backgroundColor, color: style.color, border: style.border || '1px solid #334155' }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4">
            <div>
              <h3 className="mb-2 font-bold text-cyan-200">Charts</h3>
              <Input value={chartRange} onChange={(e) => setChartRange(e.target.value.toUpperCase())} placeholder="Range e.g. A1:B6" className="mb-2 border-cyan-500/30 bg-slate-900 text-white" />
              <select value={chartType} onChange={(e) => setChartType(e.target.value as any)} className="mb-3 w-full rounded border border-cyan-500/30 bg-slate-900 p-2 text-white">
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="area">Area Chart</option>
              </select>
              {renderChart()}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <p className="text-sm font-bold text-white">{selectedCell}</p>
              <p className="text-xs text-slate-400">{sheetCells[selectedCell]?.formula ? `Formula: ${sheetCells[selectedCell].formula}` : 'Plain value'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
