import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Check, X, ExternalLink, Loader2, Shuffle, AlertCircle } from 'lucide-react'

interface MigrationClaim {
  id: string
  user_id: string
  platform_name: string
  platform_user_id: string
  platform_profile_url: string | null
  proof_screenshot_url: string | null
  verification_status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  user_profiles?: {
    username: string
    email?: string
    avatar_url?: string
  }
}

export default function CreatorSwitchApprovals() {
  const { user } = useAuthStore()
  const [claims, setClaims] = useState<MigrationClaim[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'history'>('pending')

  const loadClaims = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('creator_migration_claims')
        .select(`
          *,
          user_profiles!creator_migration_claims_user_id_fkey (
            username,
            email,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })

      if (filter === 'pending') {
        query = query.eq('verification_status', 'pending')
      } else {
        query = query.neq('verification_status', 'pending')
      }

      const { data, error } = await query

      if (error) throw error
      setClaims(data || [])
    } catch (err) {
      console.error('Error loading claims:', err)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadClaims()
  }, [loadClaims])

  const handleApprove = async (claim: MigrationClaim) => {
    if (!user) return
    const confirm = window.confirm(`Approve application for @${claim.user_profiles?.username}? This will grant Founder Badge and 7-day boost.`)
    if (!confirm) return

    setProcessingId(claim.id)
    try {
      const { data, error } = await supabase.rpc('approve_creator_claim', {
        p_claim_id: claim.id,
        p_admin_id: user.id
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Failed to approve')

      toast.success('Application approved successfully')
      loadClaims()
    } catch (err: any) {
      console.error('Error approving claim:', err)
      toast.error(err.message || 'Failed to approve')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (claim: MigrationClaim) => {
    if (!user) return
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    setProcessingId(claim.id)
    try {
      const { data, error } = await supabase.rpc('reject_creator_claim', {
        p_claim_id: claim.id,
        p_admin_id: user.id,
        p_reason: reason
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Failed to reject')

      toast.success('Application rejected')
      loadClaims()
    } catch (err: any) {
      console.error('Error rejecting claim:', err)
      toast.error(err.message || 'Failed to reject')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Shuffle className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Creator Switch Applications</h2>
            <p className="text-sm text-gray-400">Review and verify streamer migration claims</p>
          </div>
        </div>

        <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'pending' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('history')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'history' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-12 bg-black/20 rounded-xl border border-white/5">
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No {filter} applications found</h3>
        </div>
      ) : (
        <div className="grid gap-4">
          {claims.map((claim) => (
            <div key={claim.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-purple-500/30 transition-colors">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-start gap-4">
                    <img 
                      src={claim.user_profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${claim.user_id}`}
                      alt={claim.user_profiles?.username}
                      className="w-12 h-12 rounded-full bg-zinc-800"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        @{claim.user_profiles?.username || 'Unknown User'}
                        <span className="text-xs font-normal px-2 py-0.5 rounded bg-zinc-800 text-gray-400">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </span>
                      </h3>
                      <p className="text-gray-400 text-sm">{claim.user_profiles?.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/30 p-4 rounded-lg border border-white/5">
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-bold">Platform</span>
                      <p className="text-white font-medium">{claim.platform_name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-bold">Username/ID</span>
                      <p className="text-white font-medium">{claim.platform_user_id}</p>
                    </div>
                    {claim.platform_profile_url && (
                      <div className="col-span-full">
                        <span className="text-xs text-gray-500 uppercase font-bold">Profile Link</span>
                        <a 
                          href={claim.platform_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm mt-1"
                        >
                          {claim.platform_profile_url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {claim.proof_screenshot_url && (
                      <div className="col-span-full">
                        <span className="text-xs text-gray-500 uppercase font-bold">Proof Screenshot</span>
                        <a 
                          href={claim.proof_screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-1"
                        >
                          View Screenshot <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {claim.rejection_reason && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-200">
                      <strong>Rejection Reason:</strong> {claim.rejection_reason}
                    </div>
                  )}
                </div>

                {filter === 'pending' && (
                  <div className="flex flex-row md:flex-col gap-3 justify-center md:justify-start md:min-w-[140px]">
                    <button
                      onClick={() => handleApprove(claim)}
                      disabled={processingId === claim.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
                    >
                      {processingId === claim.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(claim)}
                      disabled={processingId === claim.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
                    >
                      {processingId === claim.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                )}
                
                {filter === 'history' && (
                  <div className="flex items-center justify-center md:justify-start md:min-w-[140px]">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase ${
                      claim.verification_status === 'approved' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {claim.verification_status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
