import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

interface ChatReport {
  id: string
  stream_id: string
  reason: string
  status: string
  created_at: string
  reported_by_id: string
}

export default function ChatModeration() {
  const [reports, setReports] = useState<ChatReport[]>([])
  const [loading, setLoading] = useState(true)

  const loadReports = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stream_reports')
        .select('id, stream_id, reason, status, created_at, reported_by_id')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Failed to load chat reports:', error)
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-gray-400 uppercase tracking-[0.4em]">Chat Moderation</p>
          <h1 className="text-3xl font-bold">Moderate Reported Chat</h1>
          <p className="text-sm text-gray-400">
            Review recent stream chat reports and take action on suspicious activity.
          </p>
        </header>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-2xl p-6 shadow-lg shadow-black/40">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading recent chat reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center text-gray-400">No reports have been submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 text-xs uppercase tracking-[0.3em]">
                  <tr>
                    <th className="py-3 pr-4">Stream</th>
                    <th className="py-3 pr-4">Submitted By</th>
                    <th className="py-3 pr-4">Reason</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C]">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5">
                      <td className="py-3 pr-4 text-white">{report.stream_id}</td>
                      <td className="py-3 pr-4 text-gray-200">{report.reported_by_id}</td>
                      <td className="py-3 pr-4 text-gray-200">{report.reason || 'General concern'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            report.status === 'resolved'
                              ? 'bg-green-600/20 text-green-300'
                              : 'bg-yellow-600/20 text-yellow-300'
                          }`}
                        >
                          {report.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">
                        {report.created_at
                          ? new Date(report.created_at).toLocaleString()
                          : 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
