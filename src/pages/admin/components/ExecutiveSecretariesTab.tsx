import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { SecretaryAssignment } from '../../../types/admin'
import { toast } from 'sonner'
import { UserPlus, Trash2, Shield, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../../../lib/store'

interface UserOption {
  id: string
  username: string
  avatar_url: string
}

interface SecretaryAssignmentWithProfile extends SecretaryAssignment {
  secretary: {
    username: string
    avatar_url: string
  }
}

export default function ExecutiveSecretariesTab() {
  const { user } = useAuthStore()
  const [assignments, setAssignments] = useState<SecretaryAssignmentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserOption[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchAssignments()
  }, [])

  const fetchAssignments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_secretary_assignments' }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)
      setAssignments(data.assignments || [])
    } catch (error) {
      console.error('Error fetching secretaries:', error)
      toast.error('Failed to load secretaries')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 3) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'search_users_for_secretary',
          query
        }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)
      setSearchResults(data.users || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleAssign = async (targetUser: UserOption) => {
    if (!user) return
    if (assignments.length >= 2) {
      toast.error('Maximum of 2 executive secretaries allowed')
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'assign_secretary',
          secretaryId: targetUser.id
        }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      toast.success(`Assigned ${targetUser.username} as Secretary`)
      setSearchQuery('')
      setSearchResults([])
      fetchAssignments()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to assign secretary')
    }
  }

  const handleRemove = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'remove_secretary',
          assignmentId
        }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      toast.success('Secretary removed')
      fetchAssignments()
    } catch (error) {
      console.error(error)
      toast.error('Failed to remove secretary')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Executive Secretaries
        </h2>
        <div className="text-sm text-slate-400">
          {assignments.length}/2 Assigned
        </div>
      </div>

      {assignments.length >= 2 && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <p className="text-yellow-200 text-sm">
            Maximum number of executive secretaries assigned. Remove one to add another.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Current Secretaries</h3>
          <div className="space-y-3">
            {loading ? (
              <div className="text-slate-400">Loading...</div>
            ) : assignments.length === 0 ? (
              <div className="text-slate-400 italic">No secretaries assigned</div>
            ) : (
              assignments.map(assignment => (
                <SecretaryCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  onRemove={() => handleRemove(assignment.id)} 
                />
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Assign New Secretary</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Search users by username..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white pl-10"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              disabled={assignments.length >= 2}
            />
            <UserPlus className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
            
            {searchResults.length > 0 && (
              <div className="absolute w-full bg-slate-800 border border-slate-600 rounded-lg mt-1 z-10 shadow-xl max-h-60 overflow-y-auto">
                {searchResults.map(result => (
                  <div 
                    key={result.id}
                    className="p-3 hover:bg-slate-700 cursor-pointer flex items-center gap-3 border-b border-slate-700 last:border-0"
                    onClick={() => handleAssign(result)}
                  >
                    <img src={result.avatar_url || 'https://via.placeholder.com/40'} alt={result.username} className="w-8 h-8 rounded-full" />
                    <span className="text-white font-medium">{result.username}</span>
                  </div>
                ))}
              </div>
            )}
            {searching && <div className="text-xs text-slate-400 mt-1">Searching...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function SecretaryCard({ assignment, onRemove }: { assignment: SecretaryAssignmentWithProfile, onRemove: () => void }) {
  const profile = assignment.secretary;

  return (
    <div className="bg-slate-900 p-4 rounded-lg flex justify-between items-center border border-slate-700">
      <div className="flex items-center gap-3">
        <img src={profile.avatar_url || 'https://via.placeholder.com/40'} alt={profile.username} className="w-10 h-10 rounded-full" />
        <div>
          <p className="text-white font-bold">{profile.username}</p>
          <p className="text-xs text-slate-500">Assigned: {new Date(assignment.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <button 
        onClick={onRemove}
        className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
        title="Remove Secretary"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
