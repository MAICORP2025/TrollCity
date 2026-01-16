import React, { useEffect, useState } from 'react'
import BottomNavigation from '../BottomNavigation'
import Sidebar from '../Sidebar'
import Header from '../Header'
import { useLocation } from 'react-router-dom'
import PWAInstallPrompt from '../PWAInstallPrompt'
import UserCompliancePrompt from '../UserCompliancePrompt'
import PurchaseRequiredModal from '../PurchaseRequiredModal'
import GeminiChatButton from '../GeminiChatButton'
import AdminOnly from '../AdminOnly'

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
  const [isMobile, setIsMobile] = useState(false);
  // Hide UI elements on specific routes if needed, or rely on props
  const isAuthPage = location.pathname.startsWith('/auth');
  const isLivePage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/broadcast/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  // Overrides based on route
  const effectiveShowSidebar = showSidebar && !isAuthPage && !isLivePage;
  const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage;
  // On Live page, we might want BottomNav on mobile for navigation, but maybe not if it covers controls.
  // User said "Bottom Nav 'SIDEBAR' ... for main pages". Live page is a main page.
  // Let's keep it for now, unless it's the broadcaster view.
  const effectiveShowBottomNav = showBottomNav && !isAuthPage;
  const mainPaddingClass = effectiveShowBottomNav ? 'app-content app-content--with-nav' : 'app-content app-content--no-nav';

  return (
    <div className="app-viewport w-screen overflow-hidden text-white flex">
      <PurchaseRequiredModal />
      <PWAInstallPrompt />
      <AdminOnly>
        {!isLivePage || !isMobile ? <GeminiChatButton /> : null}
      </AdminOnly>
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
