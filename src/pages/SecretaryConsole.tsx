import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  LayoutDashboard, 
  Inbox, 
  DollarSign, 
  Gift, 
  Bell, 
  FileText, 
  LogOut,
  ShieldAlert
} from 'lucide-react'
import ExecutiveIntakeList from './admin/components/shared/ExecutiveIntakeList'
import CashoutRequestsList from './admin/components/shared/CashoutRequestsList'
import GiftCardFulfillmentList from './admin/components/shared/GiftCardFulfillmentList'
import CriticalAlertsList from './admin/components/shared/CriticalAlertsList'
import ExecutiveReportsList from './admin/components/shared/ExecutiveReportsList'

type TabId = 'intake' | 'cashouts' | 'giftcards' | 'alerts' | 'reports'

export default function SecretaryConsole() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('intake')
  const [loading, setLoading] = useState(true)
  const [suspended, setSuspended] = useState(false)
  const [counts, setCounts] = useState({
    intake: 0,
    cashouts: 0,
    alerts: 0
  })

  const fetchCounts = useCallback(async () => {
    try {
        const [intakeRes, cashoutRes, alertsRes] = await Promise.all([
            supabase.from('executive_intake').select('id', { count: 'exact', head: true }).eq('status', 'new'),
            supabase.from('cashout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('critical_alerts').select('id', { count: 'exact', head: true }).eq('resolved', false)
        ])
        
        setCounts({
            intake: intakeRes.count || 0,
            cashouts: cashoutRes.count || 0,
            alerts: alertsRes.count || 0
        })
    } catch (e) {
        console.error("Error fetching counts", e)
    }
  }, [])

  const checkAccess = useCallback(async () => {
    if (!user) {
      navigate('/')
      return
    }

    try {
      // 1. Check if secretary
      const { data: secData, error: secError } = await supabase
        .from('secretary_assignments')
        .select('id')
        .eq('secretary_id', user.id)
        .maybeSingle()

      if (secError) throw secError
      
      if (!secData && profile?.role !== 'admin') {
        toast.error('Unauthorized access')
        navigate('/')
        return
      }

      // 2. Get privileges
      const { data: _privData, error: privError } = await supabase.rpc('get_effective_privileges')
      if (privError) {
        console.error('Privilege check failed', privError)
      } else {
        // Check suspension via privileges or profile
        if (profile?.is_officer_active === false) {
            setSuspended(true)
            toast.error('Your account is currently suspended. Actions are disabled.')
        }
      }

    } catch (error) {
      console.error('Access check failed:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [user, navigate, profile])

  // Global UI Rules Implementation
  useEffect(() => {
    checkAccess()
    fetchCounts()
    
    // Subscribe to changes for counts
    const sub = supabase.channel('secretary-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'executive_intake' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'critical_alerts' }, () => fetchCounts())
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [checkAccess, fetchCounts])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Verifying credentials...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-purple-500" />
            Secretary Console
          </h1>
          <p className="text-xs text-slate-500 mt-2">Executive Operations</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton 
            active={activeTab === 'intake'} 
            onClick={() => setActiveTab('intake')}
            icon={<Inbox className="w-5 h-5" />}
            label="Intake Inbox"
            alert={counts.intake > 0}
            count={counts.intake}
          />
          <NavButton 
            active={activeTab === 'cashouts'} 
            onClick={() => setActiveTab('cashouts')}
            icon={<DollarSign className="w-5 h-5" />}
            label="Cashout Queue"
            alert={counts.cashouts > 0}
            count={counts.cashouts}
          />
          <NavButton 
            active={activeTab === 'giftcards'} 
            onClick={() => setActiveTab('giftcards')}
            icon={<Gift className="w-5 h-5" />}
            label="Gift Card Fulfillment"
          />
          <NavButton 
            active={activeTab === 'alerts'} 
            onClick={() => setActiveTab('alerts')}
            icon={<Bell className="w-5 h-5" />}
            label="Critical Alerts"
            alert={counts.alerts > 0}
            count={counts.alerts}
          />
          <NavButton 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<FileText className="w-5 h-5" />}
            label="Report Builder"
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img src={profile?.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" />
            <div>
              <p className="text-white text-sm font-medium">{profile?.username}</p>
              <p className="text-xs text-slate-500">Executive Secretary</p>
            </div>
          </div>
          {suspended && (
             <div className="bg-red-900/20 border border-red-500/50 p-2 rounded mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-300">Account Suspended</span>
             </div>
          )}
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" /> Exit Console
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto pointer-events-auto">
        {suspended && (
            <div className="absolute inset-0 z-50 pointer-events-none">
                <div className="bg-slate-950/50 absolute inset-0 backdrop-blur-[1px]" />
            </div>
        )}
        <div className={suspended ? 'opacity-50 pointer-events-none select-none' : ''}>
            {activeTab === 'intake' && <ExecutiveIntakeList viewMode="secretary" />}
            {activeTab === 'cashouts' && <CashoutRequestsList viewMode="secretary" />}
            {activeTab === 'giftcards' && <GiftCardFulfillmentList viewMode="secretary" />}
            {activeTab === 'alerts' && <CriticalAlertsList viewMode="secretary" />}
            {activeTab === 'reports' && <ExecutiveReportsList viewMode="secretary" />}
        </div>
      </div>
    </div>
  )
}

const NavButton = ({ active, onClick, icon, label, alert, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; alert?: boolean; count?: number }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all relative ${
      active
        ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/20'
        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
    }`}
  >
    {alert && !count && (
      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
    )}
    {count !== undefined && count > 0 && (
       <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-red-400">
         {count > 99 ? '99+' : count}
       </span>
    )}
    {icon}
    <span className="font-bold text-sm">{label}</span>
  </button>
)
