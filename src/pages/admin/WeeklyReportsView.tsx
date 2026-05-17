import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Calendar, FileText, User, Download, Search } from 'lucide-react'

interface WeeklyReport {
  id: string
  officer_id: string
  officer_username: string
  week_start: string
  week_end: string
  work_summary: string
  challenges_faced: string | null
  achievements: string | null
  streams_moderated: number
  actions_taken: number
  recommendations: string | null
  submitted_at: string
}

interface OfficerProfile {
  id: string
  username: string
  role: string
  is_lead_officer: boolean
  is_troll_officer: boolean
}

export default function WeeklyReportsView() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [officers, setOfficers] = useState<OfficerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOfficer, setFilterOfficer] = useState<string>('')
  const [filterWeek, setFilterWeek] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const loadReports = React.useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .order('submitted_at', { ascending: false })

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load weekly reports')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOfficers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, is_lead_officer, is_troll_officer')
        .or('is_lead_officer.eq.true,is_troll_officer.eq.true')
        .order('username')

      if (error) throw error
      setOfficers(data || [])
    } catch (error) {
      console.error('Error loading officers:', error)
    }
  }, [])

  useEffect(() => {
    loadReports()
    loadOfficers()
  }, [loadReports, loadOfficers])

  const filteredReports = reports.filter(report => {
    const matchesOfficer = !filterOfficer || report.officer_id === filterOfficer
    const matchesWeek = !filterWeek || report.week_start === filterWeek
    const matchesSearch = !searchTerm || 
      report.officer_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.work_summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.achievements && report.achievements.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesOfficer && matchesWeek && matchesSearch
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
    
    if (sameMonth) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`
    } else {
      return `${formatDate(start)} - ${formatDate(end)}`
    }
  }

  const getOfficerType = (officerId: string) => {
    const officer = officers.find(o => o.id === officerId)
    if (!officer) return 'Unknown'
    
    if (officer.is_lead_officer) return 'Lead Officer'
    if (officer.is_troll_officer) return 'Troll Officer'
    return officer.role || 'Officer'
  }

  const exportReports = () => {
    const csvContent = [
      ['Officer', 'Type', 'Week Start', 'Week End', 'Streams Moderated', 'Actions Taken', 'Work Summary', 'Achievements', 'Challenges', 'Recommendations', 'Submitted'],
      ...filteredReports.map(report => [
        report.officer_username,
        getOfficerType(report.officer_id),
        report.week_start,
        report.week_end,
        report.streams_moderated.toString(),
        report.actions_taken.toString(),
        `"${report.work_summary.replace(/"/g, '""')}"`,
        `"${(report.achievements || '').replace(/"/g, '""')}"`,
        `"${(report.challenges_faced || '').replace(/"/g, '""')}"`,
        `"${(report.recommendations || '').replace(/"/g, '""')}"`,
        report.submitted_at
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `weekly-reports-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-white">Loading weekly reports...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-400" />
          Weekly Officer Reports
        </h2>
        <button
          onClick={exportReports}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-black/60 border border-purple-600 rounded-lg p-4">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Officer
            </label>
            <select
              value={filterOfficer}
              onChange={(e) => setFilterOfficer(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-purple-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Officers</option>
              {officers.map(officer => (
                <option key={officer.id} value={officer.id}>
                  {officer.username} ({getOfficerType(officer.id)})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Week
            </label>
            <select
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-purple-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Weeks</option>
              {Array.from(new Set(reports.map(r => r.week_start)))
                .sort()
                .map(weekStart => (
                  <option key={weekStart} value={weekStart}>
                    Week of {formatDate(weekStart)}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-purple-300 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by officer name or content..."
              className="w-full px-3 py-2 bg-black/40 border border-purple-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Reports Found</p>
            <p className="text-sm">No weekly reports match your current filters</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="bg-black/60 border border-purple-600/30 rounded-xl p-6 hover:bg-black/80 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {report.officer_username}
                    </h3>
                    <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded-full">
                      {getOfficerType(report.officer_id)}
                    </span>
                  </div>
                  <p className="text-purple-400 text-sm flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Week of {formatDateRange(report.week_start, report.week_end)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Submitted {formatDate(report.submitted_at)}
                  </p>
                </div>
                <div className="flex gap-4 text-sm text-purple-300">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {report.streams_moderated} streams
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {report.actions_taken} actions
                  </span>
                </div>
              </div>

              {/* Work Summary */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-purple-300 mb-2">Work Summary</h4>
                <p className="text-white bg-black/20 rounded-lg p-3">{report.work_summary}</p>
              </div>

              {/* Two Column Layout for Additional Info */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Achievements */}
                {report.achievements && (
                  <div>
                    <h4 className="text-sm font-medium text-purple-300 mb-2">Key Achievements</h4>
                    <p className="text-white bg-black/20 rounded-lg p-3">{report.achievements}</p>
                  </div>
                )}

                {/* Challenges */}
                {report.challenges_faced && (
                  <div>
                    <h4 className="text-sm font-medium text-purple-300 mb-2">Challenges Faced</h4>
                    <p className="text-white bg-black/20 rounded-lg p-3">{report.challenges_faced}</p>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {report.recommendations && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-purple-300 mb-2">Recommendations & Suggestions</h4>
                  <p className="text-white bg-black/20 rounded-lg p-3">{report.recommendations}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {filteredReports.length > 0 && (
        <div className="bg-black/60 border border-purple-600/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Summary Statistics</h3>
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-400">{filteredReports.length}</div>
              <div className="text-sm text-purple-300">Total Reports</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {filteredReports.reduce((sum, r) => sum + r.streams_moderated, 0)}
              </div>
              <div className="text-sm text-green-300">Streams Moderated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {filteredReports.reduce((sum, r) => sum + r.actions_taken, 0)}
              </div>
              <div className="text-sm text-blue-300">Actions Taken</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {new Set(filteredReports.map(r => r.officer_id)).size}
              </div>
              <div className="text-sm text-yellow-300">Active Officers</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}