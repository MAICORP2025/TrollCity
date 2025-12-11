import React from 'react'
import { Calendar, FileText, Target, Award, AlertCircle, Lightbulb, Clock } from 'lucide-react'

interface WeeklyReport {
  id: string
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

interface WeeklyReportsListProps {
  reports: WeeklyReport[]
}

export default function WeeklyReportsList({ reports }: WeeklyReportsListProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-green-400">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium mb-2">No Weekly Reports Yet</p>
        <p className="text-sm opacity-70">Submit your first weekly report to get started</p>
      </div>
    )
  }

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

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-green-200 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Recent Reports ({reports.length})
      </h4>
      
      {reports.map((report) => (
        <div key={report.id} className="bg-black/40 border border-green-600/30 rounded-xl p-4 hover:bg-black/60 transition-colors">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h5 className="font-semibold text-green-200 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Week of {formatDateRange(report.week_start, report.week_end)}
              </h5>
              <p className="text-xs text-green-400 mt-1">
                Submitted {formatDate(report.submitted_at)}
              </p>
            </div>
            <div className="flex gap-4 text-xs text-green-300">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {report.streams_moderated} streams
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3" />
                {report.actions_taken} actions
              </span>
            </div>
          </div>

          {/* Work Summary */}
          <div className="mb-3">
            <h6 className="text-sm font-medium text-green-300 mb-1 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Work Summary
            </h6>
            <p className="text-sm text-green-100 bg-black/20 rounded-lg p-3">
              {report.work_summary}
            </p>
          </div>

          {/* Achievements */}
          {report.achievements && (
            <div className="mb-3">
              <h6 className="text-sm font-medium text-green-300 mb-1 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Key Achievements
              </h6>
              <p className="text-sm text-green-100 bg-black/20 rounded-lg p-3">
                {report.achievements}
              </p>
            </div>
          )}

          {/* Challenges */}
          {report.challenges_faced && (
            <div className="mb-3">
              <h6 className="text-sm font-medium text-green-300 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Challenges Faced
              </h6>
              <p className="text-sm text-green-100 bg-black/20 rounded-lg p-3">
                {report.challenges_faced}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations && (
            <div>
              <h6 className="text-sm font-medium text-green-300 mb-1 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                Recommendations & Suggestions
              </h6>
              <p className="text-sm text-green-100 bg-black/20 rounded-lg p-3">
                {report.recommendations}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}