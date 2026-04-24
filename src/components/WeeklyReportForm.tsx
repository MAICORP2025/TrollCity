import React, { useState } from 'react'
import { Calendar, FileText, Target, Award, AlertCircle, Lightbulb } from 'lucide-react'

interface WeeklyReportFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
  loading: boolean
}

export default function WeeklyReportForm({ onSubmit, onCancel, loading }: WeeklyReportFormProps) {
  const [formData, setFormData] = useState({
    weekStart: '',
    weekEnd: '',
    workSummary: '',
    challenges: '',
    achievements: '',
    streamsModerated: 0,
    actionsTaken: 0,
    recommendations: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.weekStart || !formData.weekEnd || !formData.workSummary) {
      alert('Please fill in all required fields')
      return
    }
    onSubmit(formData)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Get current week's dates
  const getCurrentWeekDates = () => {
    const now = new Date()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    }
  }

  React.useEffect(() => {
    const dates = getCurrentWeekDates()
    setFormData(prev => ({
      ...prev,
      weekStart: dates.start,
      weekEnd: dates.end
    }))
  }, [])

  return (
    <div className="bg-black/60 border border-green-500/30 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-green-200 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Submit Weekly Report
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Week Range */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Week Start Date *
            </label>
            <input
              type="date"
              value={formData.weekStart}
              onChange={(e) => handleInputChange('weekStart', e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-green-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Week End Date *
            </label>
            <input
              type="date"
              value={formData.weekEnd}
              onChange={(e) => handleInputChange('weekEnd', e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
        </div>

        {/* Work Summary */}
        <div>
          <label className="block text-sm font-medium text-green-300 mb-2">
            <Target className="w-4 h-4 inline mr-1" />
            Work Summary *
          </label>
          <textarea
            value={formData.workSummary}
            onChange={(e) => handleInputChange('workSummary', e.target.value)}
            placeholder="Describe your activities and responsibilities this week..."
            rows={3}
            className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* Achievements */}
        <div>
          <label className="block text-sm font-medium text-green-300 mb-2">
            <Award className="w-4 h-4 inline mr-1" />
            Key Achievements
          </label>
          <textarea
            value={formData.achievements}
            onChange={(e) => handleInputChange('achievements', e.target.value)}
            placeholder="Highlight your accomplishments and successful actions..."
            rows={2}
            className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Challenges */}
        <div>
          <label className="block text-sm font-medium text-green-300 mb-2">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Challenges Faced
          </label>
          <textarea
            value={formData.challenges}
            onChange={(e) => handleInputChange('challenges', e.target.value)}
            placeholder="Describe any difficulties or challenges encountered..."
            rows={2}
            className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-300 mb-2">
              Streams Moderated
            </label>
            <input
              type="number"
              value={formData.streamsModerated}
              onChange={(e) => handleInputChange('streamsModerated', parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-green-300 mb-2">
              Actions Taken
            </label>
            <input
              type="number"
              value={formData.actionsTaken}
              onChange={(e) => handleInputChange('actionsTaken', parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <label className="block text-sm font-medium text-green-300 mb-2">
            <Lightbulb className="w-4 h-4 inline mr-1" />
            Recommendations & Suggestions
          </label>
          <textarea
            value={formData.recommendations}
            onChange={(e) => handleInputChange('recommendations', e.target.value)}
            placeholder="Suggest improvements or additional resources needed..."
            rows={2}
            className="w-full px-3 py-2 bg-black/40 border border-green-600/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}