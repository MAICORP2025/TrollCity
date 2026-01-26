import React, { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { toast } from 'sonner'
import { BookOpen, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Application {
  id: string
  user_id: string
  type: string
  status: string
  data: any
  created_at: string
  user_profiles?: {
    username: string
    avatar_url: string
  }
}

export default function PastorApplicationsList() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApps = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles:user_id (username, avatar_url)
        `)
        .eq('type', 'pastor')
        .order('created_at', { ascending: false })

      if (error) throw error
      setApps(data || [])
    } catch (err) {
      console.error('Error fetching pastor apps:', err)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApps()
  }, [])

  const handleAction = async (app: Application, status: 'approved' | 'rejected') => {
    try {
      // 1. Update application status
      const { error: appError } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', app.id)

      if (appError) throw appError

      // 2. If approved, grant pastor role
      if (status === 'approved') {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ is_pastor: true })
          .eq('id', app.user_id)

        if (profileError) throw profileError
        toast.success(`Approved ${app.user_profiles?.username} as Pastor`)
      } else {
        toast.info('Application rejected')
      }

      fetchApps()
    } catch (err) {
      console.error('Error updating application:', err)
      toast.error('Failed to update application')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          Pastor Applications
        </h2>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : apps.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No pending pastor applications</div>
        ) : (
          apps.map(app => (
            <div key={app.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={app.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${app.user_profiles?.username}`} 
                    className="w-10 h-10 rounded-full bg-slate-800"
                  />
                  <div>
                    <div className="font-bold text-white">{app.user_profiles?.username}</div>
                    <div className="text-xs text-slate-500">{new Date(app.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  app.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  app.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {app.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300 mb-4">
                <div>
                  <span className="text-slate-500 block text-xs">Denomination</span>
                  {app.data.denomination}
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Motivation</span>
                  {app.data.motivation}
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Experience</span>
                  {app.data.experience}
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Availability</span>
                  {app.data.availability}
                </div>
              </div>

              {app.status === 'pending' && (
                <div className="flex gap-2 justify-end border-t border-slate-700/50 pt-3">
                  <button
                    onClick={() => handleAction(app, 'rejected')}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 text-sm"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <button
                    onClick={() => handleAction(app, 'approved')}
                    className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1.5 text-sm"
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
