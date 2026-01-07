import React, { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ExecutiveReport } from '../../../../types/admin'
import { toast } from 'sonner'
import { FileText, CheckCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '../../../../lib/store'

interface ExecutiveReportsListProps {
  viewMode: 'admin' | 'secretary'
}

export default function ExecutiveReportsList({ viewMode }: ExecutiveReportsListProps) {
  const { user } = useAuthStore()
  const [reports, setReports] = useState<ExecutiveReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [newReport, setNewReport] = useState({ title: '', summary: '' })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('executive_reports')
        .select('*')
        .order('report_date', { ascending: false })

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReport = async () => {
    if (!user || !newReport.title || !newReport.summary) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      const { error } = await supabase
        .from('executive_reports')
        .insert({
          title: newReport.title,
          summary: newReport.summary,
          report_date: new Date().toISOString(),
          created_by: user.id,
          reviewed_by_admin: false
        })

      if (error) throw error
      toast.success('Report submitted successfully')
      setNewReport({ title: '', summary: '' })
      setShowBuilder(false)
      fetchReports()
    } catch (error) {
      console.error(error)
      toast.error('Failed to submit report')
    }
  }

  const handleMarkReviewed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('executive_reports')
        .update({ reviewed_by_admin: true })
        .eq('id', id)

      if (error) throw error
      toast.success('Marked as reviewed')
      fetchReports()
    } catch (error) {
      console.error(error)
      toast.error('Failed to update report')
    }
  }

  return (
    <div className="space-y-6">
      {viewMode === 'secretary' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Executive Report Builder
            </h2>
            <button 
              onClick={() => setShowBuilder(!showBuilder)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded flex items-center gap-2"
            >
              {showBuilder ? 'Cancel' : <><Plus className="w-4 h-4" /> New Report</>}
            </button>
          </div>

          {showBuilder && (
            <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Report Title</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                  value={newReport.title}
                  onChange={e => setNewReport({...newReport, title: e.target.value})}
                  placeholder="e.g. Daily Intake Summary - Jan 6"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Executive Summary</label>
                <textarea 
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white h-32"
                  value={newReport.summary}
                  onChange={e => setNewReport({...newReport, summary: e.target.value})}
                  placeholder="Detailed summary of activities, issues, and resolutions..."
                />
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={handleSubmitReport}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium"
                >
                  Submit Report
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">Submitted Reports</h2>
        
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-slate-400">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center text-slate-400">No reports found</div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                <div 
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{report.title}</h3>
                      {report.reviewed_by_admin && (
                        <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Reviewed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(report.report_date).toLocaleDateString()} • By {report.created_by.slice(0, 8)}
                    </p>
                  </div>
                  {expandedId === report.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                </div>
                
                {expandedId === report.id && (
                  <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                    <p className="text-slate-300 whitespace-pre-wrap">{report.summary}</p>
                    
                    {viewMode === 'admin' && !report.reviewed_by_admin && (
                      <div className="mt-4 flex justify-end">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkReviewed(report.id)
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> Mark as Reviewed
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
