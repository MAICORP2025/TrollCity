import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import CourtEntryModal from './CourtEntryModal'
import SidebarGroup from './ui/SidebarGroup'
import {
  Home,
  MessageSquare,
  Coins,
  Shield,
  Gavel,
  LayoutDashboard,
  Banknote,
  FileText,
  Store,
  ShoppingBag,
  Crown,
  Trophy,
  Package,
  Scale,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Shuffle,
  Star,
  Building2,
  Vote,
  TrendingUp,
  Waves,
  Car,
  BookOpen,
  Megaphone,
  Radio,
  Warehouse,
  Landmark,
  Video,
  Mic,
  Lock,
  Files,
  Gamepad2,
  Music,
  Newspaper,
  Users,
  Briefcase,
  AlertTriangle,
  List
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { useSidebarUpdates } from '@/hooks/useSidebarUpdates'
import { useJailMode } from '@/hooks/useJailMode'
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown'
import { useTutorial } from '@/components/TutorialWalkthrough'




import UserProfileWidget from './sidebar/UserProfileWidget';
import { getGlowingTextStyle } from '@/lib/perkEffects'

import { useSidebarStore } from '@/stores/useSidebarStore';

export default function Sidebar() {
  const { profile } = useAuthStore()
  const { level, progress, fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { balances, loading } = useCoins()
  const { isUpdated, markAsViewed } = useSidebarUpdates()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeTrollFamily, setCanSeeTrollFamily] = useState(false)
  const [hasFamily, setHasFamily] = useState(false)
  const [isFamilyLeader, setIsFamilyLeader] = useState(false)
  const [isFamilyMember, setIsFamilyMember] = useState(false)
  const [canSeeSecretary, setCanSeeSecretary] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isAttorney, setIsAttorney] = useState(false)
  const [isProsecutor, setIsProsecutor] = useState(false)
  const [canSeeInmates, setCanSeeInmates] = useState(false)
  const [isBackgroundJailed, setIsBackgroundJailed] = useState(false)
  const [isApprovedAuctioneer, setIsApprovedAuctioneer] = useState(false)

  const [showCourtModal, setShowCourtModal] = useState(false)
  const { isCollapsed, setCollapsed, expandedGroups, toggleGroup, expandGroup } = useSidebarStore();
  const isSidebarCollapsed = isCollapsed;
  const setIsSidebarCollapsed = setCollapsed;

  const { isJailed } = useJailMode();
  const { isBroadcastLockedDown } = useBroadcastLockdown();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profile?.id) return
      
      try {
        // Check if user is officer
        const { data: officerData } = await supabase
          .from('officer_members')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle()
        setCanSeeOfficer(!!officerData)

        // Check if user has a family - check both member tables
        const { data: familyData } = await supabase
          .from('troll_families')
          .select('*')
          .or(`leader_id.eq.${profile.id}`)
          .maybeSingle()
        
        // If no direct leader match, check family members tables separately
        let finalFamilyData = familyData;
        if (!finalFamilyData) {
          const { data: memberData } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', profile.id)
            .limit(1)
            .maybeSingle()
          
          if (memberData) {
            const { data: familyFromMembers } = await supabase
              .from('troll_families')
              .select('*')
              .eq('id', memberData.family_id)
              .maybeSingle()
            if (familyFromMembers) finalFamilyData = familyFromMembers;
          }
        }
        
        if (!finalFamilyData) {
          const { data: trollMemberData } = await supabase
            .from('troll_family_members')
            .select('family_id')
            .eq('user_id', profile.id)
            .limit(1)
            .maybeSingle()
          
          if (trollMemberData) {
            const { data: familyFromTrollMembers } = await supabase
              .from('troll_families')
              .select('*')
              .eq('id', trollMemberData.family_id)
              .maybeSingle()
            if (familyFromTrollMembers) finalFamilyData = familyFromTrollMembers;
          }
        }
        
        // Also grant family access if user has troll_family role (from approved application)
        const hasFamilyRole = profile?.role === 'troll_family' || profile?.troll_role === 'troll_family';
        
        if (familyData || hasFamilyRole) {
          setHasFamily(true)
          setIsFamilyLeader(familyData?.leader_id === profile.id)
          setIsFamilyMember(true)
        } else {
          setHasFamily(false)
          setIsFamilyLeader(false)
          setIsFamilyMember(false)
        }

        // Check if user can see Troll Family
        setCanSeeTrollFamily(!!familyData || hasFamilyRole || profile?.role === UserRole.ADMIN)

        // Check if user is secretary
        const { data: secData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', profile.id)
          .single()
        setCanSeeSecretary(secData?.role === UserRole.SECRETARY || secData?.role === UserRole.ADMIN)
        setIsStaff(secData?.role === UserRole.SECRETARY || secData?.role === UserRole.ADMIN || !!officerData)
        
        // Check if user is attorney
        const { data: attorneyData } = await supabase
          .from('user_profiles')
          .select('is_attorney')
          .eq('id', profile.id)
          .single()
        setIsAttorney(attorneyData?.is_attorney === true)
        
        // Check if user is prosecutor
        const { data: prosecutorData } = await supabase
          .from('user_profiles')
          .select('is_prosecutor')
          .eq('id', profile.id)
          .single()
        setIsProsecutor(prosecutorData?.is_prosecutor === true)
        
        // Check if user is approved auctioneer
        const { data: auctioneerData } = await supabase
          .from('auctioneer_profiles')
          .select('id, is_active')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .maybeSingle()
        setIsApprovedAuctioneer(!!auctioneerData)
        
        // Staff can see inmates page
        setCanSeeInmates(!!officerData || secData?.role === UserRole.ADMIN || secData?.role === UserRole.LEAD_TROLL_OFFICER)
        
        // Check background jail status
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('is_background_jailed')
          .eq('id', profile.id)
          .single()
        setIsBackgroundJailed(profileData?.is_background_jailed === true)
        
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }

    fetchUserData()
  }, [profile?.id, profile])

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/pool')) {
      expandGroup('Social');
    } else if (path.startsWith('/marketplace')) {
      expandGroup('City Center');
    } else if (path.startsWith('/government')) {
      expandGroup('Government Sector');
    } else if (path.startsWith('/city-registry')) {
      expandGroup('City Registry');
    }
  }, [location.pathname, expandGroup]);

  const isAdmin = profile?.role === UserRole.ADMIN || profile?.troll_role === UserRole.ADMIN || profile?.role === UserRole.HR_ADMIN || profile?.is_admin;
  const isSecretary = profile?.role === UserRole.SECRETARY || profile?.troll_role === UserRole.SECRETARY;
  const isLead = profile?.role === UserRole.LEAD_TROLL_OFFICER || profile?.is_lead_officer || profile?.troll_role === UserRole.LEAD_TROLL_OFFICER || isAdmin;

  const canSeeCourt = profile?.role === UserRole.TROLL_OFFICER || profile?.role === UserRole.LEAD_TROLL_OFFICER || profile?.role === UserRole.ADMIN || profile?.is_troll_officer;

  const canBroadcast = () => {
    return !isBroadcastLockedDown && (profile?.role === UserRole.BROADCASTER || profile?.is_broadcaster || profile?.troll_role === UserRole.BROADCASTER);
  }

  const mainPaths = ['/', '/inventory', '/marketplace', '/leaderboard', '/credit-scores', '/store', '/creator-switch', '/troll-court', '/troll-games']
  const supportPaths = ['/support', '/safety']
  const socialPaths = ['/tcps', '/pool', '/mai-talent']
  if (profile?.role === 'troll_family') {
    socialPaths.push('/family/home')
  } else {
    socialPaths.push('/family/browse')
    if (canSeeTrollFamily) socialPaths.push('/family/home')
  }
  const specialAccessPaths: string[] = []
  if (canSeeCourt) specialAccessPaths.push('/admin/court-dockets')
  if (canSeeOfficer) specialAccessPaths.push('/officer/dashboard')
  if (isLead) specialAccessPaths.push('/lead-officer')
  if (canSeeSecretary) specialAccessPaths.push('/secretary')
  if (isAdmin) specialAccessPaths.push('/admin/applications')
  if (profile?.role === 'president' || profile?.troll_role === 'president') specialAccessPaths.push('/government')
  const systemPaths = ['/application', '/interview-room', '/wallet']
  const isAnyUpdated = (paths: string[]) => paths.some(path => isUpdated(path))

  return (
    <div className={`flex flex-col h-[100dvh] max-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] backdrop-blur-2xl border-r border-yellow-500/40 shadow-[12px_0_48px_rgba(0,0,0,0.4),0_0_20px_rgba(234,179,8,0.12),inset_0_0_20px_rgba(234,179,8,0.04)] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} fixed left-0 top-0 z-50`}>

      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-yellow-500/20 bg-white/[0.02]">
        {!isSidebarCollapsed && (
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.3)]">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              Mai Troll City
            </span>
          </Link>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`p-2 hover:bg-white/[0.06] rounded-lg text-slate-400 hover:text-white transition-all duration-200 ${isSidebarCollapsed ? 'mx-auto' : ''}`}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* User Profile Summary - Show for all logged-in users */}
      {!isSidebarCollapsed && profile && (
        <div className="px-2 pt-2">
            <UserProfileWidget />
          </div>
      )}

      {/* Navigation - Grid Layout */}
      <div className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar min-h-0">
        {/* Admins are exempt from jail restrictions */}
        {isJailed && !(profile?.role === 'admin' || profile?.is_admin) ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <Lock className="text-red-500" size={32} />
              </div>
              <div>
                <p className="text-red-500 font-bold uppercase tracking-wider text-xs">Access Restricted</p>
                <p className="text-gray-400 text-[10px] mt-1">City services suspended while incarcerated.</p>
              </div>
            </div>
            <GridItem icon={Lock} label="Jail" to="/jail" active={isActive('/jail')} className="text-red-400" />
            {isBackgroundJailed && (
              <GridItem icon={AlertTriangle} label="Appeal" to="/jail/appeal?active=false" active={isActive('/jail/appeal')} className="text-yellow-400" />
            )}
            <GridItem icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* Go Live Button */}
            <div className="col-span-2 mb-2">
              {canBroadcast() ? (
                <Link
                  to="/broadcast/setup"
                  className="flex items-center justify-center gap-2 w-full p-3 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 hover:from-yellow-500 hover:via-yellow-300 hover:to-yellow-500 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.5)] transition-all duration-300 hover:scale-[1.02] border border-yellow-200/50"
                >
                  <Video size={20} className="text-black" />
                  <span className="uppercase tracking-wide text-sm">Go Live</span>
                </Link>
              ) : (
                <div className="flex items-center justify-center gap-2 w-full p-3 bg-gray-600/50 text-gray-400 font-bold rounded-xl border border-gray-500/30 cursor-not-allowed">
                  <Video size={20} className="text-gray-500" />
                  <span className="uppercase tracking-wide text-sm">Go Live</span>
                </div>
              )}
            </div>

            {/* City Center */}
            <GridItem icon={Home} label="Home" to="/home" active={isActive('/home')} highlight={isUpdated('/home')} onClick={() => markAsViewed('/home')} />
            <GridItem icon={Gavel} label="Live Auctions" to="/auctions" active={isActive('/auctions')} highlight={isUpdated('/auctions')} onClick={() => markAsViewed('/auctions')} className="text-green-400" />
            <GridItem icon={Home} label="Neighborhoods" to="/neighborhood-setup" active={isActive('/neighborhood-setup')} highlight={isUpdated('/neighborhood-setup')} onClick={() => markAsViewed('/neighborhood-setup')} />
            <GridItem icon={Shield} label="Insurance" to="/insurance" active={isActive('/insurance')} highlight={isUpdated('/insurance')} onClick={() => markAsViewed('/insurance')} className="text-yellow-400" />
            <GridItem icon={Warehouse} label="Living" to="/living" active={isActive('/living')} highlight={isUpdated('/living')} onClick={() => markAsViewed('/living')} />
            <GridItem icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} highlight={isUpdated('/inventory')} onClick={() => markAsViewed('/inventory')} />
            <GridItem icon={Store} label="Marketplace" to="/marketplace" active={isActive('/marketplace')} highlight={isUpdated('/marketplace')} onClick={() => markAsViewed('/marketplace')} />
            <GridItem icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} highlight={isUpdated('/leaderboard')} onClick={() => markAsViewed('/leaderboard')} />
            <GridItem icon={TrendingUp} label="Credit" to="/credit-scores" active={isActive('/credit-scores')} highlight={isUpdated('/credit-scores')} onClick={() => markAsViewed('/credit-scores')} />
            <GridItem icon={Coins} label="Coin Store" to="/store" active={isActive('/store')} highlight={isUpdated('/store')} onClick={() => markAsViewed('/store')} />
            <GridItem icon={Shuffle} label="Creator" to="/creator-switch" active={isActive('/creator-switch')} highlight={isUpdated('/creator-switch')} onClick={() => markAsViewed('/creator-switch')} />
            <GridItem icon={Scale} label="Troll Court" to="/troll-court" active={isActive('/troll-court')} highlight={isUpdated('/troll-court')} onClick={() => markAsViewed('/troll-court')} />
            <GridItem icon={Crown} label="President" to="/president" active={isActive('/president')} highlight={isUpdated('/president')} onClick={() => markAsViewed('/president')} />

            {/* Public Services */}
            {canSeeInmates && (
              <GridItem icon={Users} label="Inmates" to="/inmates" active={isActive('/inmates')} highlight={isUpdated('/inmates')} onClick={() => markAsViewed('/inmates')} className="text-orange-400" />
            )}
            <GridItem icon={Lock} label="Jail" to="/jail" active={isActive('/jail')} highlight={isUpdated('/jail')} onClick={() => markAsViewed('/jail')} className="text-red-400" />
            <GridItem icon={BookOpen} label="Troll Church" to="/church" active={isActive('/church')} highlight={isUpdated('/church')} onClick={() => markAsViewed('/church')} />
            {((profile as any)?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin) && (
              <GridItem icon={LayoutDashboard} label="Pastor" to="/church/pastor" active={isActive('/church/pastor')} className="text-purple-400" />
            )}
            <GridItem icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} highlight={isUpdated('/support')} onClick={() => markAsViewed('/support')} />
            <GridItem icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} highlight={isUpdated('/safety')} onClick={() => markAsViewed('/safety')} />
            <GridItem icon={ShoppingBag} label="Trollified" to="/trollifieds" active={isActive('/trollifieds')} highlight={isUpdated('/trollifieds')} onClick={() => markAsViewed('/trollifieds')} className="text-green-400" />
            <GridItem icon={Building2} label="Neighbors" to="/neighbors" active={isActive('/neighbors')} highlight={isUpdated('/neighbors')} onClick={() => markAsViewed('/neighbors')} className="text-blue-400" />

            {/* Social */}
            <GridItem icon={MessageSquare} label="TCPS" to="/tcps" active={isActive('/tcps') || isActive('/messages')} highlight={isUpdated('/tcps')} onClick={() => markAsViewed('/tcps')} />
            <GridItem icon={Star} label="Mai Talent" to="/mai-talent" active={isActive('/mai-talent')} highlight={isUpdated('/mai-talent')} onClick={() => markAsViewed('/mai-talent')} className="text-pink-400" />
            <GridItem icon={Waves} label="Pool" to="/pool" active={isActive('/pool')} highlight={isUpdated('/pool')} onClick={() => markAsViewed('/pool')} className="text-cyan-400" />
            <GridItem icon={Gamepad2} label="Wheel" to="/troll-wheel" active={isActive('/troll-wheel')} highlight={isUpdated('/troll-wheel')} onClick={() => markAsViewed('/troll-wheel')} className="text-yellow-500" />
            <GridItem icon={Crown} label={hasFamily ? 'My Family' : 'Families'} to={hasFamily ? '/family/home' : '/family/browse'} active={location.pathname.startsWith('/family')} highlight={isUpdated('/family/home')} onClick={() => markAsViewed('/family/home')} className="text-amber-400" />

            {/* Government Sector */}
            {(canSeeOfficer || canSeeTrollFamily || canSeeSecretary || canSeeCourt) && (
              <>
                {(canSeeOfficer || canSeeSecretary) && (
                  <GridItem icon={Radio} label="Streams" to="/government/streams" active={location.pathname.startsWith('/government/streams')} highlight={isUpdated('/government/streams')} onClick={() => markAsViewed('/government/streams')} className="text-red-400" />
                )}
                {(canSeeOfficer || canSeeSecretary || profile?.role === 'president' || profile?.troll_role === 'president' || isAdmin) && (
                  <GridItem icon={Landmark} label="Government" to="/government" active={location.pathname === '/government'} highlight={isUpdated('/government')} onClick={() => markAsViewed('/government')} className="text-yellow-400" />
                )}
                {canSeeCourt && (
                  <GridItem icon={Gavel} label="Dockets" to="/admin/court-dockets" active={location.pathname.startsWith('/admin/court-dockets')} highlight={isUpdated('/admin/court-dockets')} onClick={() => markAsViewed('/admin/court-dockets')} className="text-orange-400" />
                )}
                {isAttorney && (
                  <GridItem icon={Briefcase} label="Attorney" to="/attorney" active={isActive('/attorney')} highlight={isUpdated('/attorney')} onClick={() => markAsViewed('/attorney')} className="text-amber-400" />
                )}
                {isProsecutor && (
                  <GridItem icon={Shield} label="Prosecutor" to="/prosecutor" active={isActive('/prosecutor')} highlight={isUpdated('/prosecutor')} onClick={() => markAsViewed('/prosecutor')} className="text-red-400" />
                )}
                {canSeeOfficer && (
                  <GridItem icon={LayoutDashboard} label="Officer" to="/officer/dashboard" active={location.pathname.startsWith('/officer/dashboard')} highlight={isUpdated('/officer/dashboard')} onClick={() => markAsViewed('/officer/dashboard')} className="text-emerald-400" />
                )}
                {isLead && (
                  <GridItem icon={Star} label="Lead HQ" to="/lead-officer" active={location.pathname.startsWith('/lead-officer')} highlight={isUpdated('/lead-officer')} onClick={() => markAsViewed('/lead-officer')} className="text-yellow-400" />
                )}
                {canSeeSecretary && (
                  <GridItem icon={LayoutDashboard} label="Secretary" to="/secretary" active={location.pathname.startsWith('/secretary')} highlight={isUpdated('/secretary')} onClick={() => markAsViewed('/secretary')} className="text-pink-400" />
                )}
                {(profile?.is_journalist || profile?.is_news_caster || profile?.is_chief_news_caster || isAdmin || profile?.role === UserRole.SUPERADMIN || profile?.is_superadmin) && (
                  <GridItem icon={Newspaper} label="TCNN" to="/tcnn/dashboard" active={location.pathname.startsWith('/tcnn/dashboard')} highlight={isUpdated('/tcnn/dashboard')} onClick={() => markAsViewed('/tcnn/dashboard')} className="text-blue-400" />
                )}
                {isAdmin && (
                  <GridItem icon={FileText} label="Applications" to="/admin/applications" active={location.pathname.startsWith('/admin/applications')} highlight={isUpdated('/admin/applications')} onClick={() => markAsViewed('/admin/applications')} className="text-red-400" />
                )}
              </>
            )}

            {/* Auctioneer Section - Only for approved auctioneers */}
            {isApprovedAuctioneer && (
              <>
                <div className="px-3 py-2 mt-2">
                  <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Auctioneer</span>
                </div>
                <GridItem icon={Gavel} label="Auction Studio" to="/auctions/studio" active={location.pathname.startsWith('/auctions/studio')} highlight={isUpdated('/auctions/studio')} onClick={() => markAsViewed('/auctions/studio')} className="text-green-400" />
                <GridItem icon={List} label="My Shows" to="/auctions/my-shows" active={location.pathname.startsWith('/auctions/my-shows')} highlight={isUpdated('/auctions/my-shows')} onClick={() => markAsViewed('/auctions/my-shows')} className="text-green-400" />
              </>
            )}

            {/* Auction Reports & Admin - For officers/admins */}
            {(isLead || isAdmin) && (
              <>
                <div className="px-3 py-2 mt-2">
                  <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Auction Admin</span>
                </div>
                <GridItem icon={AlertTriangle} label="Reports" to="/auctions/reports" active={location.pathname.startsWith('/auctions/reports')} highlight={isUpdated('/auctions/reports')} onClick={() => markAsViewed('/auctions/reports')} className="text-red-400" />
                <GridItem icon={FileText} label="Applications" to="/auctions/applications" active={location.pathname.startsWith('/auctions/applications')} highlight={isUpdated('/auctions/applications')} onClick={() => markAsViewed('/auctions/applications')} className="text-purple-400" />
              </>
            )}

            {/* City Registry */}
            <GridItem icon={FileText} label="Careers" to="/career" active={isActive('/career')} highlight={isUpdated('/career')} onClick={() => markAsViewed('/career')} />
            <GridItem icon={Briefcase} label="Broker Application" to="/broker-application" active={isActive('/broker-application')} highlight={isUpdated('/broker-application')} onClick={() => markAsViewed('/broker-application')} />
            <GridItem icon={Video} label="Interview" to="/interview-room" active={isActive('/interview-room')} highlight={isUpdated('/interview-room')} onClick={() => markAsViewed('/interview-room')} />
            <GridItem icon={Banknote} label="Wallet" to="/wallet" active={isActive('/wallet')} highlight={isUpdated('/wallet')} onClick={() => markAsViewed('/wallet')} />
            <GridItem icon={Scale} label="Appeals" to="/city-registry" active={isActive('/city-registry')} highlight={isUpdated('/city-registry')} onClick={() => markAsViewed('/city-registry')} />
            <GridItem icon={Megaphone} label="Advertise" to="/city-registry/advertise" active={isActive('/city-registry/advertise')} highlight={isUpdated('/city-registry/advertise')} onClick={() => markAsViewed('/city-registry/advertise')} />
</div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-yellow-500/20">
        <Link
          to="/stats"
          className="flex items-center justify-center gap-3 w-full p-2.5 rounded-lg hover:bg-white/[0.04] text-slate-400 hover:text-white transition-all duration-200"
        >
          <LayoutDashboard size={18} />
          <span className="text-[13px] font-medium">Stats</span>
        </Link>
      </div>

      {/* Modals */}
      {showCourtModal && <CourtEntryModal isOpen={true} onClose={() => setShowCourtModal(false)} />}
    </div>
  )
}

function GridItem({ 
  icon: Icon, 
  label, 
  to, 
  active, 
  highlight,
  onClick,
  className = '' 
}: { 
  icon: any, 
  label: string, 
  to: string, 
  active?: boolean, 
  highlight?: boolean,
  onClick?: () => void,
  className?: string 
}) {
  const { targetPage, isActive: tutorialActive } = useTutorial()
  const isTutorialTarget = tutorialActive && targetPage?.path === to
  
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        relative z-0 flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all duration-200 group
        ${active ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}
        ${isTutorialTarget ? 'ring-2 animate-pulse' : ''}
        ${className}
      `}
      style={isTutorialTarget ? {
        boxShadow: '0 0 25px rgba(255, 0, 127, 0.8), 0 0 50px rgba(0, 200, 255, 0.5), inset 0 0 20px rgba(255, 0, 127, 0.2)'
      } : {}}
    >
      <Icon size={20} className={`shrink-0 ${isTutorialTarget ? 'text-pink-400' : ''}`} />
      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
      {highlight && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>
      )}
    </Link>
  )
}
