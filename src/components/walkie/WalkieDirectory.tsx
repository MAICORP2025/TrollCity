import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { User } from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { usePresenceStore } from '../../lib/presenceStore'

interface StaffMember {
  id: string
  username: string
  role: string
  is_admin: boolean
  is_lead_officer: boolean
  is_troll_officer: boolean
  avatar_url?: string
}

interface WalkieDirectoryProps {
  onPage: (userId: string) => void
  disabled?: boolean
}

export default function WalkieDirectory({ onPage, disabled }: WalkieDirectoryProps) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const { user: currentUser } = useAuthStore()
  const { onlineUserIds } = usePresenceStore()

  useEffect(() => {
    const fetchStaff = async () => {
      // Fetch all staff
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, is_admin, is_lead_officer, is_troll_officer, avatar_url')
        .or('role.in.(admin,moderator,troll_officer,lead_troll_officer,secretary),is_admin.eq.true,is_troll_officer.eq.true')
        .neq('id', currentUser?.id) // Exclude self
        .limit(50)

      if (!error && data) {
        // Double check client side to filter out anyone who is strictly a 'user'
        const validStaff = (data as StaffMember[]).filter(m => 
          m.is_admin || 
          m.is_troll_officer || 
          m.is_lead_officer || 
          ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary'].includes(m.role)
        )
        setStaff(validStaff)
      }
      setLoading(false)
    }

    fetchStaff()
  }, [currentUser])

  if (loading) return <div className="p-4 text-center text-xs text-slate-500">Loading directory...</div>

  return (
    <div className="flex-1 overflow-y-auto space-y-2 p-2">
      {staff.length === 0 && (
        <div className="text-center text-slate-500 text-xs py-4">No other staff found.</div>
      )}
      
      {staff.map((member) => {
        const isOnline = onlineUserIds.includes(member.id)
        return (
        <div 
          key={member.id}
          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center">
                 {member.avatar_url ? (
                   <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                 ) : (
                   <User className="w-4 h-4 text-slate-400" />
                 )}
              </div>
              <div 
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-800 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
            <div>
              <div className="font-medium text-sm text-slate-200 flex items-center gap-2">
                {member.username}
                <span className={`text-[10px] ${isOnline ? 'text-green-400' : 'text-slate-500'}`}>
                  {isOnline ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                {member.is_admin || member.role === 'admin' ? 'Admin' : 
                 member.is_lead_officer ? 'Lead Officer' :
                 member.is_troll_officer || member.role === 'troll_officer' ? 'Troll Officer' :
                 member.role === 'secretary' ? 'Secretary' :
                 member.role === 'moderator' ? 'Moderator' :
                 'Staff'}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => onPage(member.id)}
            disabled={disabled}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded shadow-lg shadow-purple-900/20"
          >
            PAGE
          </button>
        </div>
      )})}
    </div>
  )
}
