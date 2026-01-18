import React, { useEffect } from 'react'
import BottomNavigation from '../BottomNavigation'
import Sidebar from '../Sidebar'
import Header from '../Header'
import DrivingScene from '../DrivingScene'
import { useLocation } from 'react-router-dom'
import PWAInstallPrompt from '../PWAInstallPrompt'
import UserCompliancePrompt from '../UserCompliancePrompt'
import PurchaseRequiredModal from '../PurchaseRequiredModal'
import { useAuthStore } from '../../lib/store'
import { UserRole } from '../../lib/supabase'

interface AppLayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
  showHeader?: boolean
  showBottomNav?: boolean
}

export default function AppLayout({ 
  children, 
  showSidebar = true, 
  showHeader = true, 
  showBottomNav = true 
}: AppLayoutProps) {
  const location = useLocation();
  const profile = useAuthStore((s) => s.profile)
  const showLegacySidebar = useAuthStore((s) => s.showLegacySidebar)
  const isAuthPage = location.pathname.startsWith('/auth');
  const isLivePage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/broadcast/');
  const isStaff = Boolean(
    profile &&
      (
        profile.role === UserRole.ADMIN ||
        profile.role === UserRole.TROLL_OFFICER ||
        profile.role === UserRole.LEAD_TROLL_OFFICER ||
        profile.role === UserRole.HR_ADMIN ||
        profile.is_admin ||
        profile.is_troll_officer ||
        profile.is_lead_officer
      )
  )

  useEffect(() => {
    if (typeof window === 'undefined') return;
  }, []);

  const effectiveShowSidebar = showSidebar && isStaff && showLegacySidebar && !isAuthPage && !isLivePage;
  const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage;
  const effectiveShowBottomNav = showBottomNav && !isAuthPage;
  const mainPaddingClass = effectiveShowBottomNav ? 'app-content app-content--with-nav' : 'app-content app-content--no-nav';

  return (
    <div className="app-viewport w-screen overflow-hidden text-white flex relative">
      <DrivingScene />
      <PurchaseRequiredModal />
      <PWAInstallPrompt />
      {/* Desktop Sidebar - Hidden on Mobile */}
      {effectiveShowSidebar && (
        <div className="hidden md:block w-64 h-full shrink-0 border-r border-white/5 bg-[#0A0814] z-20">
          <Sidebar />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Header - Sticky or Fixed */}
        {effectiveShowHeader && (
          <div className="shrink-0 z-20">
            <Header />
          </div>
        )}

        {/* User Compliance Prompt */}
        {!isAuthPage && <UserCompliancePrompt />}

        {/* Main Content Area */}
        <main className={`flex-1 w-full h-full relative overflow-x-hidden scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent ${mainPaddingClass}`}>
          {children}
        </main>

        {/* Mobile Bottom Navigation - Fixed at bottom */}
        {effectiveShowBottomNav && (
          <div className="md:hidden shrink-0 z-30">
            <BottomNavigation />
          </div>
        )}
      </div>
    </div>
  )
}
