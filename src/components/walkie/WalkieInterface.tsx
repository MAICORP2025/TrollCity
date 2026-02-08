import React, { useEffect, useState } from 'react'
import { X, Shield, Users, Radio, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../lib/store'
import { walkieApi, WalkieSession as WalkieSessionData, PagingRequest } from '../../lib/walkie'
import WalkieDirectory from './WalkieDirectory'
import BugReportForm from './BugReportForm'
import WalkieSession from './WalkieSession'
import { toast } from 'sonner'

interface WalkieInterfaceProps {
  isOpen: boolean
  onClose: () => void
}

type ViewMode = 'directory' | 'bug_mode' | 'active_session'

export default function WalkieInterface({ isOpen, onClose }: WalkieInterfaceProps) {
  const { user, profile } = useAuthStore()
  const [mode, setMode] = useState<ViewMode>('directory')
  const [activeSession, setActiveSession] = useState<WalkieSessionData | null>(null)
  const [pendingPages, setPendingPages] = useState<PagingRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Subscriptions
  useEffect(() => {
    if (!user) return

    // Initial fetch
    const fetchInitial = async () => {
      const session = await walkieApi.getActiveSession()
      if (session) {
        setActiveSession(session)
        setMode('active_session')
      }

      const pages = await walkieApi.getPendingPages()
      if (pages) {
        const myPages = pages.filter((p: any) => p.receiver_id === user.id)
        setPendingPages(myPages)
      }
    }
    fetchInitial()

    // Subscribe to pages
    const pageSub = walkieApi.subscribeToPages(user.id, (payload) => {
      console.log('Page update:', payload)
      if (payload.eventType === 'INSERT') {
        // Add new page
        // We need to fetch the sender details ideally, but for now just raw data
        // Or re-fetch pending pages to get sender details
        walkieApi.getPendingPages().then(pages => {
            const myPages = pages ? pages.filter((p: any) => p.receiver_id === user.id) : []
            setPendingPages(myPages)
            toast('New Incoming Page!', { icon: <Radio className="w-4 h-4 text-yellow-400"/> })
        })
      } else if (payload.eventType === 'UPDATE') {
        // Maybe it was cancelled or handled
         walkieApi.getPendingPages().then(pages => {
            const myPages = pages ? pages.filter((p: any) => p.receiver_id === user.id) : []
            setPendingPages(myPages)
        })
      }
    })

    return () => {
      pageSub.unsubscribe()
    }
  }, [user])

  // Handle Page Send
  const handlePage = async (targetId: string) => {
    try {
      setIsLoading(true)
      await walkieApi.sendPage(targetId, 'standard')
      toast.success('Page sent!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to page')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Bug Report
  const handleBugReport = async (data: { type: string; severity: string; description: string }) => {
    try {
      setIsLoading(true)
      // We need to find an admin ID. For now, we page ALL admins or just create a request with no specific receiver?
      // The RPC expects a receiver.
      // We should probably have a "System Admin" user or query for an online admin.
      // Requirement: "Bug Mode... Always targets Admin".
      // Let's query for a random admin or "Head Admin".
      // For now, I'll use a placeholder logic: page the first admin found.
      // Ideally the backend `send_walkie_page` should handle "target=admin" logic if receiver is null?
      // But my RPC requires receiver_id.
      // I'll update the RPC logic later if needed, but for now let's find an admin.
      
      // Temporary: Just find one admin.
      // Real impl: The backend should fan-out to all admins.
      // Let's assume there is at least one admin.
      
      // Better: The Bug Mode creates a request that all admins can see.
      // My schema has `receiver_id`.
      // I'll just pick one admin for now to make it work, or change schema to allow null receiver (broadcast to role).
      // Given constraints, I'll fetch an admin.
      
      const { data: admins } = await import('../../lib/supabase').then(m => m.supabase
        .from('user_profiles')
        .select('id')
        .eq('is_admin', true)
        .limit(1)
      )
      
      if (!admins || admins.length === 0) throw new Error('No admin available to receive report')
      
      await walkieApi.sendPage(admins[0].id, 'bug', data)
      toast.success('Bug report sent to Admin. Waiting for response...')
      setMode('directory')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send report')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Response
  const handleResponse = async (pageId: string, response: 'accepted' | 'declined') => {
    try {
      setIsLoading(true)
      const res = await walkieApi.respondToPage(pageId, response)
      if (response === 'accepted' && res.session_id) {
         // Join session
         // Active session will be picked up by effect
         toast.success('Connecting...')
      } else {
         toast('Request declined')
         setPendingPages(prev => prev.filter(p => p.id !== pageId))
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!activeSession) return
    await walkieApi.endSession(activeSession.id)
    setActiveSession(null)
    setMode('directory')
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-4 w-80 h-[500px] bg-[#0A0814] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-bold text-sm tracking-wider">WALKIE</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Incoming Pages Alert */}
      {pendingPages.length > 0 && mode !== 'active_session' && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-2">
          {pendingPages.map(page => (
            <div key={page.id} className="flex items-center justify-between p-2 bg-yellow-900/20 rounded mb-1">
              <div className="text-xs">
                <span className="font-bold text-yellow-200">
                  {page.metadata?.type === 'bug' ? 'BUG REPORT' : 'Incoming Page'}
                </span>
                <div className="text-yellow-400/70">from {page.sender_id.slice(0, 8)}...</div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleResponse(page.id, 'accepted')}
                  className="px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-500"
                >
                  ACCEPT
                </button>
                <button 
                  onClick={() => handleResponse(page.id, 'declined')}
                  className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-500"
                >
                  DECLINE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950/50 overflow-y-auto">
        {mode === 'active_session' && activeSession ? (
          <WalkieSession session={activeSession} onEnd={handleEndSession} />
        ) : mode === 'bug_mode' ? (
          <BugReportForm 
            onSubmit={handleBugReport} 
            onCancel={() => setMode('directory')}
            isSubmitting={isLoading}
          />
        ) : (
          <WalkieDirectory onPage={handlePage} disabled={isLoading} />
        )}
      </div>

      {/* Footer / Tabs */}
      {mode !== 'active_session' && (
        <div className="flex border-t border-white/5 bg-slate-900">
          <button
            onClick={() => setMode('directory')}
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors",
              mode === 'directory' ? "text-purple-400 bg-purple-500/5" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Staff</span>
          </button>
          
          <button
            onClick={() => setMode('bug_mode')}
            className={cn(
              "flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors",
              mode === 'bug_mode' ? "text-red-400 bg-red-500/5" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Bug Mode</span>
          </button>
        </div>
      )}
    </div>
  )
}
