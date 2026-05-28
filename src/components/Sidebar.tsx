import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
   AlertTriangle,
   Banknote,
   BookOpen,
   Briefcase,
   Building2,
   Calendar,
   ChevronLeft,
   ChevronRight,
   Coins,
   Crown,
   FileText,
   Gamepad2,
   Gavel,
   Home,
   Landmark,
   LayoutDashboard,
   LifeBuoy,
   List,
   Lock,
   Mail,
   Megaphone,
   MessageSquare,
   Newspaper,
   Package,
   Radio,
   Scale,
   Shield,
   ShoppingBag,
   Shuffle,
   Star,
   Store,
   TrendingUp,
   Trophy,
   Users,
   Video,
   Warehouse,
   Waves,
 } from 'lucide-react'

import CourtEntryModal from './CourtEntryModal'
import UserProfileWidget from './sidebar/UserProfileWidget'
import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { canAccessTromail } from '@/lib/tromail'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { useSidebarUpdates } from '@/hooks/useSidebarUpdates'
import { useJailMode } from '@/hooks/useJailMode'
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown'
import { useSidebarStore } from '@/stores/useSidebarStore'
import { STORE_USD_PER_COIN } from '@/lib/coinMath'

type GridGlow = 'green' | 'pink' | 'cyan' | 'red' | 'purple' | 'teal'

type GridItemTone = 'default' | 'green' | 'blue' | 'cyan' | 'pink' | 'red' | 'orange' | 'purple' | 'teal'

type GridItemProps = {
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  label: string
  to: string
  active?: boolean
  highlight?: boolean
  onClick?: () => void
  className?: string
  underConstruction?: boolean
  glow?: GridGlow
  collapsed?: boolean
  tone?: GridItemTone
  badge?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function SectionTitle({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return null

  return (
    <div className="col-span-2 mt-4 first:mt-0 px-1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/45 via-purple-400/25 to-transparent" />
        {title}
        <span className="h-px flex-1 bg-gradient-to-l from-pink-400/45 via-purple-400/25 to-transparent" />
      </div>
    </div>
  )
}

function ShellBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-300/65 to-transparent" />
    </>
  )
}

export default function Sidebar() {
  const { user, profile } = useAuthStore()
  const { level } = useXPStore()
  const { balances } = useCoins()
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
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)
  const [hasOrganization, setHasOrganization] = useState(false)
  const [showCourtModal, setShowCourtModal] = useState(false)

  const { isCollapsed, setCollapsed, expandGroup } = useSidebarStore()
  const isSidebarCollapsed = isCollapsed
  const setIsSidebarCollapsed = setCollapsed
  const { isJailed } = useJailMode()
  const { isBroadcastLockedDown } = useBroadcastLockdown()

  const isAdmin =
    profile?.role === UserRole.ADMIN ||
    profile?.troll_role === UserRole.ADMIN ||
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    profile?.is_admin ||
profile?.role === 'superadmin' ||
    profile?.troll_role === 'ceo' ||
    !!(profile as { is_superadmin?: boolean })?.is_superadmin

  const isAgentHRManager =
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.ADMIN

  const isSecretary = profile?.role === UserRole.SECRETARY || profile?.troll_role === UserRole.SECRETARY

  const isLead =
    profile?.role === UserRole.LEAD_TROLL_OFFICER ||
    profile?.is_lead_officer ||
    profile?.troll_role === UserRole.LEAD_TROLL_OFFICER ||
    isAdmin

  const canSeeCourt = !!user && !!profile
  const canAccessOrgDashboard = hasOrganization || isOrgAdmin || isAdmin || isStaff || isSecretary || canSeeOfficer || canSeeSecretary
  const canAccessMaiClass = canAccessOrgDashboard || profile?.role === 'student' || (profile as any)?.is_org_student

  const canBroadcast = () => {
    return !isBroadcastLockedDown &&
      profile?.drivers_license_status !== 'suspended' &&
      (profile?.role === UserRole.BROADCASTER ||
        profile?.is_broadcaster ||
        profile?.troll_role === UserRole.BROADCASTER)
  }

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profile?.id) return

      try {
        const { data: officerData } = await supabase
          .from('officer_members')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle()
        setCanSeeOfficer(!!officerData)

        const { data: orgAdminData } = await supabase
          .from('organization_admins')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle()
        setIsOrgAdmin(!!orgAdminData)
        setHasOrganization(!!profile.organization_id)

        const { data: familyData } = await supabase
          .from('troll_families')
          .select('*')
          .or(`leader_id.eq.${profile.id}`)
          .maybeSingle()

        let finalFamilyData = familyData

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
            if (familyFromMembers) finalFamilyData = familyFromMembers
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
            if (familyFromTrollMembers) finalFamilyData = familyFromTrollMembers
          }
        }

        const hasFamilyRole = profile?.role === 'troll_family' || profile?.troll_role === 'troll_family'

        if (finalFamilyData || hasFamilyRole) {
          setHasFamily(true)
          setIsFamilyLeader(finalFamilyData?.leader_id === profile.id)
          setIsFamilyMember(true)
        } else {
          setHasFamily(false)
          setIsFamilyLeader(false)
          setIsFamilyMember(false)
        }

        setCanSeeTrollFamily(!!finalFamilyData || hasFamilyRole || profile?.role === UserRole.ADMIN)

        const { data: secData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', profile.id)
          .single()
        setCanSeeSecretary(
          secData?.role === UserRole.SECRETARY ||
            secData?.role === UserRole.ADMIN ||
            secData?.role === UserRole.EXECUTIVE_SECRETARY ||
            secData?.role === UserRole.TROLL_CITY_SECRETARY ||
            !!(profile?.is_admin as boolean | undefined) ||
            !!(profile?.is_secretary as boolean | undefined) ||
            profile?.role === 'superadmin' ||
            profile?.role === 'ceo' ||
            !!(profile?.troll_role &&
              ['secretary', UserRole.EXECUTIVE_SECRETARY, UserRole.TROLL_CITY_SECRETARY].includes(
                String(profile.troll_role),
              ))
        )
        setIsStaff(secData?.role === UserRole.SECRETARY || secData?.role === UserRole.ADMIN || !!officerData)

        const { data: attorneyData } = await supabase
          .from('user_profiles')
          .select('is_attorney')
          .eq('id', profile.id)
          .single()
        setIsAttorney(attorneyData?.is_attorney === true)

        const { data: prosecutorData } = await supabase
          .from('user_profiles')
          .select('is_prosecutor')
          .eq('id', profile.id)
          .single()
        setIsProsecutor(prosecutorData?.is_prosecutor === true)

        const { data: auctioneerData } = await supabase
          .from('auctioneer_profiles')
          .select('id, is_active')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .maybeSingle()
        setIsApprovedAuctioneer(!!auctioneerData)

        setCanSeeInmates(
          !!officerData ||
            isAdmin ||
            profile?.role === UserRole.TROLL_OFFICER ||
            profile?.troll_role === UserRole.TROLL_OFFICER ||
            profile?.is_troll_officer ||
            profile?.role === UserRole.LEAD_TROLL_OFFICER ||
            profile?.troll_role === UserRole.LEAD_TROLL_OFFICER ||
            profile?.is_lead_officer ||
            secData?.role === UserRole.ADMIN ||
            secData?.role === UserRole.LEAD_TROLL_OFFICER
        )

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
  }, [profile?.id, profile, isAdmin])

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/pool')) {
      expandGroup('Social')
    } else if (path.startsWith('/marketplace')) {
      expandGroup('City Center')
    } else if (path.startsWith('/government')) {
      expandGroup('Government Sector')
    } else if (path.startsWith('/city-registry')) {
      expandGroup('City Registry')
    } else if (path.startsWith('/career')) {
      expandGroup('Talent Offices')
    } else if (path.startsWith('/agencies') || path.startsWith('/agency-dashboard')) {
      expandGroup('Talent Offices')
    }
  }, [location.pathname, expandGroup])

  const mainPaths = ['/', '/inventory', '/marketplace', '/leaderboard', '/credit-scores', '/store', '/creator-switch', '/troll-court', '/troll-games']
  const supportPaths = ['/support', '/safety']
  const socialPaths = ['/tcps', '/pool', '/mai-talent', '/mai-class']
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
  if (canSeeSecretary || isAdmin) specialAccessPaths.push('/secretary')
  if (isAdmin) specialAccessPaths.push('/admin/applications')
  if (profile?.role === UserRole.PRESIDENT || profile?.troll_role === UserRole.PRESIDENT) specialAccessPaths.push('/government')
    const systemPaths = ['/apply', '/wallet']
  const isAnyUpdated = (paths: string[]) => paths.some(path => isUpdated(path))

  const jailedLocked = isJailed && !(profile?.role === 'admin' || profile?.is_admin)

  const quickStatus = useMemo(() => {
    const coinBalance = Number((balances as any)?.troll_coins ?? (balances as any)?.balance ?? 0)
    const cashBalance = Number((balances as any)?.cashout_coins ?? 0)
    const cashValue = cashBalance * STORE_USD_PER_COIN
    return [
      { label: 'Level', value: String(level || 1) },
      { label: 'Coins', value: coinBalance > 999 ? `${Math.floor(coinBalance / 1000)}K` : coinBalance.toLocaleString(), subValue: cashValue > 0 ? `$${cashValue.toFixed(2)}` : null },
      { label: 'Family', value: hasFamily ? 'Yes' : 'No' },
    ]
  }, [balances, hasFamily, level])

  return (
    <aside
      className={cx(
        'fixed left-0 top-0 z-50 flex h-[100dvh] max-h-screen flex-col border-r border-cyan-400/20 bg-slate-950 text-white shadow-[12px_0_48px_rgba(0,0,0,0.50),0_0_28px_rgba(45,212,191,0.10),inset_0_0_30px_rgba(147,51,234,0.08)] backdrop-blur-2xl transition-all duration-300',
        isSidebarCollapsed ? 'w-20' : 'w-72'
      )}
    >
      <ShellBackdrop />

      <div className="relative z-10 border-b border-white/10 bg-white/[0.025] p-3">
        <div className={cx('flex items-center', isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
          {!isSidebarCollapsed && (
            <Link to="/home" className="group flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-purple-700 via-cyan-500 to-pink-500 shadow-[0_0_28px_rgba(45,212,191,0.25)]">
                <span className="text-xl font-black text-white drop-shadow">T</span>
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-slate-950 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
              </div>
              <div className="min-w-0">
                <div className="truncate bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-lg font-black leading-tight text-transparent">
                  Mai Troll City
                </div>
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                  City OS
                </div>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={cx(
              'rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition-all duration-200 hover:border-cyan-300/35 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_18px_rgba(45,212,191,0.18)]',
              isSidebarCollapsed && 'mx-auto'
            )}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {!isSidebarCollapsed && profile && (
        <div className="relative z-10 px-3 pt-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <UserProfileWidget />
          </div>
        </div>
      )}

      {!isSidebarCollapsed && profile && (
        <div className="relative z-10 grid grid-cols-3 gap-2 px-3 pt-3">
          {quickStatus.map(item => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-center">
              <div className="truncate text-[10px] text-slate-400">{item.label}</div>
              <div className="truncate text-xs font-black text-cyan-100">{item.value}</div>
              {item.subValue && (
                <div className="truncate text-[9px] text-green-400 font-medium">{item.subValue}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-2 py-3 custom-scrollbar">
    {jailedLocked ? (
  <div className={cx('grid gap-2', isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
    {!isSidebarCollapsed && (
      <div className="col-span-2 space-y-4 rounded-2xl border border-red-500/25 bg-red-950/20 px-3 py-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
          <Lock className="text-red-400" size={32} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Access Restricted</p>
          <p className="mt-1 text-[10px] text-gray-400">City services suspended while incarcerated.</p>
        </div>
      </div>
    )}
    {isBackgroundJailed && (
      <GridItem collapsed={isSidebarCollapsed} icon={AlertTriangle} label="Appeal" to="/jail/appeal?active=false" active={isActive('/jail/appeal')} className="text-orange-300" tone="orange" />
    )}
    <GridItem collapsed={isSidebarCollapsed} icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} tone="blue" />
  </div>
) : (
          <div className={cx('grid gap-2', isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
            <div className={isSidebarCollapsed ? 'col-span-1 mb-2' : 'col-span-2 mb-2'}>
              {canBroadcast() ? (
                <Link
                  to="/broadcast/setup"
                  className={cx(
                    'relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-cyan-200/35 bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 font-black text-white shadow-[0_0_22px_rgba(45,212,191,0.30)] transition-all duration-300 hover:scale-[1.02] hover:from-purple-600 hover:via-cyan-400 hover:to-pink-500',
                    isSidebarCollapsed ? 'h-14 p-3' : 'gap-3 p-3.5'
                  )}
                  title="Go Live"
                >
                  <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.28),transparent)] opacity-50" />
                  <Video size={isSidebarCollapsed ? 22 : 20} className="relative z-10 text-white" />
                  {!isSidebarCollapsed && (
                    <div className="relative z-10 text-left leading-tight">
                      <div className="text-sm uppercase tracking-wide">Go Live</div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Start Broadcast</div>
                    </div>
                  )}
                </Link>
              ) : (
                <div
                  className={cx(
                    'flex w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-800/55 font-black text-slate-400',
                    isSidebarCollapsed ? 'h-14 p-3' : 'gap-3 p-3.5'
                  )}
                  title={isBroadcastLockedDown ? 'Broadcast locked down' : 'Broadcaster access required'}
                >
                  <Video size={isSidebarCollapsed ? 22 : 20} className="text-slate-500" />
                  {!isSidebarCollapsed && (
                    <div className="text-left leading-tight">
                      <div className="text-sm uppercase tracking-wide">Go Live</div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {isBroadcastLockedDown ? 'Locked' : 'Broadcaster Only'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <SectionTitle title="City Core" collapsed={isSidebarCollapsed} />
            <GridItem collapsed={isSidebarCollapsed} icon={Home} label="Home" to="/home" active={isActive('/home')} highlight={isUpdated('/home')} onClick={() => markAsViewed('/home')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Coins} label="Buy Coins" to="/store" active={isActive('/store')} highlight={isUpdated('/store')} onClick={() => markAsViewed('/store')} tone="green" glow="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Live Auctions" to="/auctions" active={isActive('/auctions')} highlight={isUpdated('/auctions')} onClick={() => markAsViewed('/auctions')} className="text-green-400" tone="green" underConstruction={!isAdmin} />
            <GridItem collapsed={isSidebarCollapsed} icon={Scale} label="Troll Court" to="/troll-court" active={isActive('/troll-court')} highlight={isUpdated('/troll-court')} onClick={() => markAsViewed('/troll-court')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Building2} label="Neighbors" to="/neighbors" active={isActive('/neighbors')} highlight={isUpdated('/neighbors')} onClick={() => markAsViewed('/neighbors')} className="text-blue-400" tone="blue" />
            <GridItem collapsed={isSidebarCollapsed} icon={Building2} label="Neighborhood" to="/neighborhood-setup" active={isActive('/neighborhood-setup')} highlight={isUpdated('/neighborhood-setup')} onClick={() => markAsViewed('/neighborhood-setup')} className="text-cyan-400" tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={MessageSquare} label="TCPS" to="/tcps" active={isActive('/tcps') || isActive('/messages')} highlight={isUpdated('/tcps')} onClick={() => markAsViewed('/tcps')} tone="cyan" />

            <SectionTitle title="City Services" collapsed={isSidebarCollapsed} />
            <GridItem collapsed={isSidebarCollapsed} icon={Megaphone} label="Advertise" to="/city-registry/advertise" active={isActive('/city-registry/advertise')} highlight={isUpdated('/city-registry/advertise')} onClick={() => markAsViewed('/city-registry/advertise')} tone="pink" />
            <GridItem collapsed={isSidebarCollapsed} icon={Scale} label="Appeals" to="/city-registry" active={isActive('/city-registry')} highlight={isUpdated('/city-registry')} onClick={() => markAsViewed('/city-registry')} tone="purple" />
            {((profile as any)?.is_journalist || profile?.is_news_caster || profile?.is_chief_news_caster || isAdmin || profile?.role === 'superadmin' || (profile as any)?.is_superadmin) && (
              <GridItem collapsed={isSidebarCollapsed} icon={Newspaper} label="TCNN" to="/tcnn/dashboard" active={location.pathname.startsWith('/tcnn/dashboard')} highlight={isUpdated('/tcnn/dashboard')} onClick={() => markAsViewed('/tcnn/dashboard')} className="text-blue-400" tone="blue" />
            )}
            {isAttorney && (
              <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Attorney" to="/attorney" active={isActive('/attorney')} highlight={isUpdated('/attorney')} onClick={() => markAsViewed('/attorney')} className="text-cyan-200" tone="cyan" />
            )}
{isApprovedAuctioneer && (
  <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Auction Studio" to="/auctions/studio" active={location.pathname.startsWith('/auctions/studio')} highlight={isUpdated('/auctions/studio')} onClick={() => markAsViewed('/auctions/studio')} className="text-green-400" tone="green" underConstruction={!isAdmin} />
)}
            <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Credit" to="/credit-scores" active={isActive('/credit-scores')} highlight={isUpdated('/credit-scores')} onClick={() => markAsViewed('/credit-scores')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Shuffle} label="Creator" to="/creator-switch" active={isActive('/creator-switch')} highlight={isUpdated('/creator-switch')} onClick={() => markAsViewed('/creator-switch')} tone="purple" />
             {canSeeCourt && (
               <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Dockets" to="/admin/court-dockets" active={location.pathname.startsWith('/admin/court-dockets')} highlight={isUpdated('/admin/court-dockets')} onClick={() => markAsViewed('/admin/court-dockets')} className="text-pink-300" tone="pink" />
             )}

<SectionTitle title="Social + Life" collapsed={isSidebarCollapsed} />
             <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Insurance" to="/insurance" active={isActive('/insurance')} highlight={isUpdated('/insurance')} onClick={() => markAsViewed('/insurance')} className="text-cyan-300" tone="cyan" />
             <GridItem collapsed={isSidebarCollapsed} icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} highlight={isUpdated('/inventory')} onClick={() => markAsViewed('/inventory')} tone="purple" />
             <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Troll Family" to="/family/browse" active={isActive('/family/browse')} highlight={isUpdated('/family/browse')} onClick={() => markAsViewed('/family/browse')} className="text-pink-400" tone="pink" />
             <GridItem collapsed={isSidebarCollapsed} icon={Crown} label="My Families" to={isFamilyMember ? "/family/home" : "/family/browse"} active={isActive('/family/home') || isActive('/family/browse')} highlight={isUpdated('/family/home')} onClick={() => markAsViewed('/family/home')} className="text-purple-400" tone="purple" />
             <GridItem collapsed={isSidebarCollapsed} icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} highlight={isUpdated('/leaderboard')} onClick={() => markAsViewed('/leaderboard')} tone="purple" />
             <GridItem collapsed={isSidebarCollapsed} icon={Warehouse} label="Living" to="/living" active={isActive('/living')} highlight={isUpdated('/living')} onClick={() => markAsViewed('/living')} tone="cyan" />
            {canAccessMaiClass && (
              <GridItem collapsed={isSidebarCollapsed} icon={BookOpen} label="Mai Class" to="/mai-class" active={isActive('/mai-class')} highlight={isUpdated('/mai-class')} onClick={() => markAsViewed('/mai-class')} className="text-green-400" glow="green" tone="green" />
            )}
             <GridItem collapsed={isSidebarCollapsed} icon={Star} label="Mai Talent" to="/mai-talent" active={isActive('/mai-talent')} highlight={isUpdated('/mai-talent')} onClick={() => markAsViewed('/mai-talent')} className="text-pink-400" tone="pink" glow="pink" underConstruction={!isAdmin} />
            <GridItem collapsed={isSidebarCollapsed} icon={Store} label="Marketplace" to="/marketplace" active={isActive('/marketplace')} highlight={isUpdated('/marketplace')} onClick={() => markAsViewed('/marketplace')} tone="purple" />
            {isApprovedAuctioneer && (
              <GridItem collapsed={isSidebarCollapsed} icon={List} label="My Shows" to="/auctions/my-shows" active={location.pathname.startsWith('/auctions/my-shows')} highlight={isUpdated('/auctions/my-shows')} onClick={() => markAsViewed('/auctions/my-shows')} className="text-green-400" tone="green" />
            )}
            <GridItem collapsed={isSidebarCollapsed} icon={Waves} label="Pool" to="/pool" active={isActive('/pool')} highlight={isUpdated('/pool')} onClick={() => markAsViewed('/pool')} className="text-cyan-400" tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} highlight={isUpdated('/safety')} onClick={() => markAsViewed('/safety')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={BookOpen} label="Troll Church" to="/church" active={isActive('/church')} highlight={isUpdated('/church')} onClick={() => markAsViewed('/church')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={ShoppingBag} label="Trollified" to="/trollifieds" active={isActive('/trollifieds')} highlight={isUpdated('/trollifieds')} onClick={() => markAsViewed('/trollifieds')} className="text-green-400" tone="green" underConstruction={!isAdmin} />
            <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Wallet" to="/wallet" active={isActive('/wallet')} highlight={isUpdated('/wallet')} onClick={() => markAsViewed('/wallet')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Gamepad2} label="Wheel" to="/troll-wheel" active={isActive('/troll-wheel')} highlight={isUpdated('/troll-wheel')} onClick={() => markAsViewed('/troll-wheel')} className="text-cyan-300" tone="cyan" />

            <SectionTitle title="Control Room" collapsed={isSidebarCollapsed} />
            {(canSeeOfficer || canSeeSecretary || profile?.role === UserRole.PRESIDENT || profile?.troll_role === UserRole.PRESIDENT || isAdmin) && (
              <GridItem collapsed={isSidebarCollapsed} icon={Landmark} label="Government" to="/government" active={location.pathname === '/government'} highlight={isUpdated('/government')} onClick={() => markAsViewed('/government')} className="text-cyan-300" tone="cyan" />
            )}
            {canSeeInmates && (
              <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Inmates" to="/inmates" active={isActive('/inmates')} highlight={isUpdated('/inmates')} onClick={() => markAsViewed('/inmates')} className="text-red-300" tone="red" />
            )}
            {canAccessOrgDashboard && (
              <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Organization" to="/organization/dashboard" active={isActive('/organization/dashboard')} highlight={isUpdated('/organization/dashboard')} onClick={() => markAsViewed('/organization/dashboard')} className="text-purple-400" tone="purple" />
            )}
            <GridItem collapsed={isSidebarCollapsed} icon={Crown} label="President" to="/president" active={isActive('/president')} highlight={isUpdated('/president')} onClick={() => markAsViewed('/president')} tone="purple" />
            {(canSeeOfficer || canSeeSecretary || isAdmin) && (
              <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="Streams" to="/government/streams" active={location.pathname.startsWith('/government/streams')} highlight={isUpdated('/government/streams')} onClick={() => markAsViewed('/government/streams')} className="text-red-400" tone="red" />
            )}
            {(isAdmin || profile?.role === UserRole.PRESIDENT || profile?.troll_role === UserRole.PRESIDENT) && (
              <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Treasury" to="/president/treasury" active={isActive('/president/treasury')} highlight={isUpdated('/president/treasury')} onClick={() => markAsViewed('/president/treasury')} className="text-emerald-300" tone="green" />
            )}
            {(canSeeSecretary || isAdmin) && (
              <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Secretary" to="/secretary" active={location.pathname.startsWith('/secretary')} highlight={isUpdated('/secretary')} onClick={() => markAsViewed('/secretary')} className="text-cyan-200" tone="cyan" />
            )}
{isAdmin && (
               <>
                 <GridItem collapsed={isSidebarCollapsed} icon={Coins} label="Coin Purchase Ledger" to="/admin/coinpurchase-ledger" active={location.pathname.startsWith('/admin/coinpurchase-ledger')} highlight={isUpdated('/admin/coinpurchase-ledger')} onClick={() => markAsViewed('/admin/coinpurchase-ledger')} className="text-cyan-300" tone="cyan" />
                 <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Startup Expense Tracker" to="/admin/startup-expense-tracker" active={location.pathname.startsWith('/admin/startup-expense-tracker')} highlight={isUpdated('/admin/startup-expense-tracker')} onClick={() => markAsViewed('/admin/startup-expense-tracker')} className="text-cyan-300" tone="cyan" />
               </>
             )}

             {/* 📧 Tromail - Internal Role Email for approved roles */}
             {canAccessTromail && canAccessTromail(profile) && (
               <GridItem collapsed={isSidebarCollapsed} icon={Mail} label="Tromail" to="/tromail" active={isActive('/tromail')} highlight={isUpdated('/tromail')} onClick={() => markAsViewed('/tromail')} className="text-cyan-300" tone="cyan" />
             )}

<SectionTitle title="Talent Offices" collapsed={isSidebarCollapsed} />
             <GridItem collapsed={isSidebarCollapsed} icon={Building2} label="Agencies" to="/agencies" active={isActive('/agencies')} highlight={isUpdated('/agencies')} onClick={() => markAsViewed('/agencies')} className="text-cyan-400" tone="cyan" />
             <GridItem collapsed={isSidebarCollapsed} icon={Users} label="My Agency" to="/agency-dashboard" active={isActive('/agency-dashboard')} highlight={isUpdated('/agency-dashboard')} onClick={() => markAsViewed('/agency-dashboard')} className="text-cyan-400" tone="cyan" />
             <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Careers" to="/career" active={isActive('/career')} highlight={isUpdated('/career')} onClick={() => markAsViewed('/career')} className="text-purple-400" tone="purple" />
             {isAgentHRManager && (
              <GridItem
                collapsed={isSidebarCollapsed}
                icon={Briefcase}
                label="Agency HR"
                to="/agency-hr-dashboard"
                active={isActive('/agency-hr-dashboard')}
                highlight={isUpdated('/agency-hr-dashboard')}
                onClick={() => markAsViewed('/agency-hr-dashboard')}
                className="text-cyan-200"
                tone="cyan"
               />
             )}

            <SectionTitle title="Support" collapsed={isSidebarCollapsed} />
            <GridItem collapsed={isSidebarCollapsed} icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} highlight={isUpdated('/support')} onClick={() => markAsViewed('/support')} tone="blue" />
          </div>
        )}
      </div>

      <div className="relative z-10 border-t border-white/10 bg-slate-950/50 p-3">
        <Link
          to="/stats"
          className={cx(
            'group flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-400 transition-all duration-200 hover:border-cyan-400/35 hover:bg-white/[0.075] hover:text-white',
            isSidebarCollapsed ? 'h-12 px-2' : 'gap-3 p-2.5'
          )}
          title="Stats"
        >
          <LayoutDashboard size={18} className="group-hover:text-cyan-200" />
          {!isSidebarCollapsed && <span className="text-[13px] font-semibold">Stats</span>}
        </Link>
      </div>

      {showCourtModal && <CourtEntryModal isOpen={true} onClose={() => setShowCourtModal(false)} />}
    </aside>
  )
}

function GridItem({
  icon: Icon,
  label,
  to,
  active,
  highlight,
  onClick,
  className = '',
  glow,
  collapsed = false,
  tone = 'default',
  badge,
  underConstruction = false,
}: GridItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (underConstruction) {
      e.preventDefault()
      return
    }
    if (onClick) onClick()
  }

  const toneMap: Record<GridItemTone, string> = {
    default: 'from-white/[0.065] via-white/[0.025] to-slate-950/20 border-white/10 hover:border-white/20',
    green: 'from-emerald-400/15 via-white/[0.025] to-slate-950/20 border-emerald-400/20 hover:border-emerald-300/40',
    blue: 'from-sky-400/15 via-white/[0.025] to-slate-950/20 border-sky-400/20 hover:border-sky-300/40',
    cyan: 'from-cyan-400/16 via-white/[0.025] to-slate-950/20 border-cyan-400/22 hover:border-cyan-300/45',
    pink: 'from-pink-400/15 via-white/[0.025] to-slate-950/20 border-pink-400/20 hover:border-pink-300/40',
    red: 'from-red-400/14 via-white/[0.025] to-slate-950/20 border-red-400/20 hover:border-red-300/40',
    orange: 'from-orange-400/12 via-white/[0.025] to-slate-950/20 border-orange-400/18 hover:border-orange-300/35',
    purple: 'from-purple-400/17 via-white/[0.025] to-slate-950/20 border-purple-400/22 hover:border-purple-300/45',
    teal: 'from-teal-400/16 via-white/[0.025] to-slate-950/20 border-teal-400/22 hover:border-teal-300/45',
  }

  const glowMap: Record<GridGlow, React.CSSProperties> = {
    green: { boxShadow: '0 0 20px rgba(34,197,94,0.32), inset 0 0 14px rgba(34,197,94,0.08)' },
    pink: { boxShadow: '0 0 20px rgba(236,72,153,0.32), inset 0 0 14px rgba(236,72,153,0.08)' },
    cyan: { boxShadow: '0 0 20px rgba(34,211,238,0.34), inset 0 0 14px rgba(34,211,238,0.08)' },
    red: { boxShadow: '0 0 20px rgba(239,68,68,0.30), inset 0 0 14px rgba(239,68,68,0.08)' },
    purple: { boxShadow: '0 0 20px rgba(147,51,234,0.34), inset 0 0 14px rgba(147,51,234,0.08)' },
    teal: { boxShadow: '0 0 20px rgba(45,212,191,0.34), inset 0 0 14px rgba(45,212,191,0.08)' },
  }

  const isUnderConstruction = underConstruction ?? false
  const effectiveActive = !isUnderConstruction && active

  return (
    <Link
      to={isUnderConstruction ? '#' : to}
      onClick={handleClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cx(
        'group relative z-0 flex overflow-hidden rounded-2xl border bg-gradient-to-br transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07]',
        toneMap[tone],
        collapsed ? 'h-14 items-center justify-center p-2' : 'min-h-[74px] flex-col items-center justify-center gap-1.5 p-3',
        effectiveActive ? 'border-cyan-300/60 bg-white/[0.09] text-white shadow-[0_0_18px_rgba(45,212,191,0.23),inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-slate-400 hover:text-white',
        isUnderConstruction ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      style={glow ? glowMap[glow] : undefined}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.14),transparent_48%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      {effectiveActive && <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-1 rounded-r-full bg-gradient-to-b from-cyan-200 via-purple-400 to-pink-400 shadow-[0_0_12px_rgba(45,212,191,0.55)]" />}

      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/42 transition-all duration-200 group-hover:border-white/20 group-hover:bg-slate-950/62">
        <Icon size={20} className="shrink-0" />
      </span>

      {!collapsed && <span className="relative z-10 text-center text-[10px] font-bold leading-tight tracking-tight">{label}</span>}

      {highlight && !isUnderConstruction && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      )}

      {badge && !collapsed && !isUnderConstruction && (
        <span className="absolute right-1 top-1 rounded bg-cyan-300 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-950 shadow-[0_0_6px_rgba(45,212,191,0.45)]">
          {badge}
        </span>
      )}
    </Link>
  )
}
