// src/App.tsx
import React, { useEffect, Suspense, useState, useRef } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "./lib/store";

import { useEligibilityStore } from "./lib/eligibilityStore";
import { supabase, UserRole } from "./lib/supabase";
import { Toaster, toast } from "sonner";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay";
import GlobalErrorBanner from "./components/GlobalErrorBanner";
import { useGlobalApp } from "./contexts/GlobalAppContext";
import { updateRoute } from "./utils/sessionStorage";
import { useDebouncedProfileUpdate } from "./hooks/useDebouncedProfileUpdate";
import { APP_DATA_REFETCH_EVENT_NAME } from "./lib/appEvents";

// Layout
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import AdminOfficerQuickMenu from "./components/AdminOfficerQuickMenu";
import ProfileSetupModal from "./components/ProfileSetupModal";
import RequireRole from "./components/RequireRole";
import { RequireLeadOrOwner } from "./components/auth/RequireLeadOrOwner";
import TrollsNightGuard from "./components/auth/TrollsNightGuard";
import ErrorBoundary from "./components/ErrorBoundary";

// Static pages (fast load)
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import TermsAgreement from "./pages/TermsAgreement";

// Sidebar pages (instant load)
import Messages from "./pages/Messages";
import Following from "./pages/Following";
import CoinStore from "./pages/CoinStore";
import Marketplace from "./pages/Marketplace";
import UserInventory from "./pages/UserInventory";
import SellOnTrollCity from "./pages/SellOnTrollCity";
import Leaderboard from "./pages/Leaderboard";
import TrollCityWall from "./pages/TrollCityWall";
import TrollCourt from "./pages/TrollCourt";
import EmpirePartnerDashboard from "./pages/EmpirePartnerDashboard";
// Gift store pages removed
import Application from "./pages/Application";
import ApplicationPage from "./pages/ApplicationPage";
import TrollsTownPage from "./pages/TrollsTownPage";
import TrollOfficerLounge from "./pages/TrollOfficerLounge";
import OfficerModeration from "./pages/OfficerModeration";
import TrollFamily from "./pages/TrollFamily";
import FamilyLounge from "./pages/FamilyLounge.jsx";
import FamilyWarsHub from "./pages/FamilyWarsHub.jsx";
import FamilyLeaderboard from "./pages/FamilyLeaderboard.jsx";
import FamilyShop from "./pages/FamilyShop.jsx";
import Support from "./pages/Support";
import Safety from "./pages/Safety";
import AdminRFC from "./components/AdminRFC";
import AdminEarningsDashboard from "./pages/admin/AdminEarningsDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ApplicationsPage from "./pages/admin/Applications";
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import AdminOfficerReports from "./pages/admin/AdminOfficerReports";
import StoreDebug from "./pages/admin/StoreDebug";
import Changelog from "./pages/Changelog";
import AccessDenied from "./pages/AccessDenied";
import ReferralBonusPanel from "./pages/admin/ReferralBonusPanel";
import { systemManagementRoutes } from "./pages/admin/adminRoutes";
import TrollsNightPage from "./pages/TrollsNightPage";

// Static imports (previously lazy)
import TrollsNightRules from "./pages/legal/TrollsNightRules";
import TrollsNightApplication from "./pages/TrollsNightApplication";
import TermsOfService from "./pages/TermsOfService";
import RefundPolicy from "./pages/RefundPolicy";
import LandingPage from "./pages/LandingPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PaymentTerms from "./pages/PaymentTerms";
import CreatorAgreement from "./pages/CreatorAgreement";
import TaxOnboarding from "./pages/TaxOnboarding";
import MyEarnings from "./pages/MyEarnings";
import EarningsPage from "./pages/EarningsPage";
import VerificationPage from "./pages/VerificationPage";
import VerificationComplete from "./pages/VerificationComplete";
import AIVerificationPage from "./pages/AIVerificationPage";

import GoLive from "./pages/GoLive";
import BroadcastPage from "./pages/BroadcastPage";
import WatchPage from "./pages/WatchPage";
import JoinPage from "./pages/Join";
import LivePage from "./pages/LivePage";
import BroadcastSummary from "./pages/BroadcastSummary";
import KickFee from "./pages/KickFee";
import BanFee from "./pages/BanFee";
import TrollCourtSession from "./pages/TrollCourtSession";
import TromodyShow from "./pages/TromodyShow";
import TromodyShowBroadcast from "./pages/TromodyShowBroadcast";
import OfficerLoungeStream from "./pages/OfficerLoungeStream";
import StreamPicture from "./pages/StreamPicture";
import Call from "./pages/Call";
import Notifications from "./pages/Notifications";
import Trollifications from "./pages/Trollifications";
import OfficerScheduling from "./pages/OfficerScheduling";
import Orientation from "./pages/officer/Orientation";
import OrientationQuiz from "./pages/officer/OrientationQuiz";
import OfficerOnboarding from "./pages/officer/OfficerOnboarding";
import OfficerTrainingSimulator from "./pages/officer/OfficerTrainingSimulator";
import OfficerTrainingProgress from "./pages/officer/OfficerTrainingProgress";
import OfficerPayrollDashboard from "./pages/officer/OfficerPayrollDashboard";
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import OfficerOWCDashboard from "./pages/OfficerOWCDashboard";
import ReportDetailsPage from "./pages/ReportDetailsPage";
import TrollFamilyCity from "./pages/TrollFamilyCity";
import FamilyProfilePage from "./pages/FamilyProfilePage";
import FamilyWarsPage from "./pages/FamilyWarsPage";
import FamilyChatPage from "./pages/FamilyChatPage";
import TransactionHistory from "./pages/TransactionHistory";
import ReelFeed from "./pages/ReelFeed";
import CashoutPage from "./pages/CashoutPage";
import FamilyApplication from "./pages/FamilyApplication";
import OfficerApplication from "./pages/OfficerApplication";
import TrollerApplication from "./pages/TrollerApplication";
import LeadOfficerApplication from "./pages/LeadOfficerApplication";
import ShopEarnings from "./pages/ShopEarnings";
import AdminPayoutMobile from "./pages/admin/AdminPayoutMobile";
import MobileAdminDashboard from "./pages/admin/MobileAdminDashboard";
import PaymentsDashboard from "./pages/admin/PaymentsDashboard";
import EconomyDashboard from "./pages/admin/EconomyDashboard";
import TaxUpload from "./pages/TaxUpload";
import TaxReviewPanel from "./pages/admin/TaxReviewPanel";
import PaymentCallback from "./pages/PaymentCallback";
import CoinsComplete from "./pages/CoinsComplete";
import PayoutSetupPage from "./pages/PayoutSetupPage";
import Withdraw from "./pages/Withdraw";
import Profile from "./pages/Profile";
import EmpirePartnerApply from "./pages/EmpirePartnerApply";
import AddCard from "./pages/AddCard";
import EarningsDashboard from "./pages/EarningsDashboard";
import CreatorOnboarding from "./pages/CreatorOnboarding";
import PolicyCenter from "./pages/PolicyCenter";
import TermsOfServiceLegal from "./pages/legal/TermsOfService";
import RefundPolicyLegal from "./pages/legal/RefundPolicy";
import PayoutPolicyLegal from "./pages/legal/PayoutPolicy";
import SafetyGuidelinesLegal from "./pages/legal/SafetyGuidelines";
import CreatorEarnings from "./pages/legal/CreatorEarnings";
import GamblingDisclosure from "./pages/legal/GamblingDisclosure";
import PartnerProgram from "./pages/legal/PartnerProgram";
import Wallet from "./pages/Wallet";
import PayoutRequest from "./pages/PayoutRequest";
import AdminPayoutDashboard from "./pages/admin/components/AdminPayoutDashboard";
import AdminLiveOfficersTracker from "./pages/admin/AdminLiveOfficersTracker";
import AdminVerifiedUsers from "./pages/admin/AdminVerifiedUsers";
import AdminVerificationReview from "./pages/admin/AdminVerificationReview";
import AdminPoliciesDocs from "./pages/admin/AdminPoliciesDocs";
import LeadOfficerReview from "./pages/lead-officer/Review";
import { LeadOfficerDashboard } from "./pages/lead-officer/LeadOfficerDashboard";
import ShopPartnerPage from "./pages/ShopPartnerPage";
import CommandBattleGoLive from "./pages/CommandBattleGoLive";
import TrollBattleSetup from "./pages/TrollBattleSetup";
import ShopView from "./pages/ShopView";
import CourtRoom from "./pages/CourtRoom";
import InterviewRoom from "./pages/InterviewRoom";

// Admin pages
import BanManagement from "./pages/admin/BanManagement";
import RoleManagement from "./pages/admin/RoleManagement";
import MediaLibrary from "./pages/admin/MediaLibrary";
import ChatModeration from "./pages/admin/ChatModeration";
import Announcements from "./pages/admin/Announcements";
import ExportData from "./pages/admin/ExportData";
import UserSearch from "./pages/admin/UserSearch";
import ReportsQueue from "./pages/admin/ReportsQueue";
import StreamMonitorPage from "./pages/admin/StreamMonitorPage";
import GrantCoins from "./pages/admin/GrantCoins";
import PaymentLogs from "./pages/admin/PaymentLogs";
import StorePriceEditor from "./pages/admin/components/StorePriceEditor";
import AdminFinanceDashboard from "./pages/admin/AdminFinanceDashboard";
import CreateSchedule from "./pages/admin/CreateSchedule";
import OfficerShifts from "./pages/admin/OfficerShifts";
import EmpireApplicationsPage from "./pages/admin/EmpireApplicationsPage";
import ReferralBonuses from "./pages/admin/ReferralBonuses";
import ControlPanel from "./pages/admin/ControlPanel";
import TestDiagnosticsPage from "./pages/admin/TestDiagnosticsPage";
import ResetMaintenance from "./pages/admin/ResetMaintenance";
import AdminHR from "./pages/admin/AdminHR";

function AppContent() {
  console.log('🚀 App component rendering...');
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  console.log('📊 App state:', { hasUser: !!user, hasProfile: !!profile, isLoading });

  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);

  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const eligibilityRefresh = useEligibilityStore((s) => s.refresh);

  // Global app context for loading and error states
  const {
    isLoading: globalLoading,
    loadingMessage,
    error,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
  } = useGlobalApp();

  // Track route changes for session persistence
  useEffect(() => {
    updateRoute(location.pathname);
  }, [location.pathname]);

  // 🔹 Auto-routing after approval (only on home page, not on every route change)
  useEffect(() => {
    // Only auto-route from home page (/) - never redirect from other pages
    if (location.pathname !== '/') {
      return;
    }

    // Don't redirect if user is not logged in
    if (!user || !profile) {
      return;
    }

    // Only redirect officers who need orientation (lead officers and admins skip quiz)
    if (profile?.role === 'troll_officer' || profile?.is_troll_officer) {
      // Admins don't need orientation/quiz - they're automatically active
      if (profile?.role === 'admin' || profile?.is_admin) {
        // Admin is already active, no redirect needed
        return;
      }
      // Lead officers don't need orientation/quiz - they're activated immediately
      if (profile?.is_lead_officer) {
        // Lead officer is already active, no redirect needed
        return;
      }
      // Regular officers need to complete orientation/quiz
      if (!profile?.is_officer_active) {
        navigate('/officer/orientation', { replace: true });
      }
    } else if (profile?.role === 'troll_family') {
      navigate('/family', { replace: true });
    }
  }, [profile, location.pathname, navigate, user]);

  // 🔹 Check if user is kicked or banned and show re-entry modal
  useEffect(() => {
    if (profile && (profile.is_kicked || profile.is_banned)) {
      // Dynamic-load the kick re-entry modal for when we need to show it.
      void import('./components/KickReentryModal');
    }
  }, [profile]);

  // 🔹 Track user IP address and check for IP bans
  useEffect(() => {
    const trackIP = async () => {
      if (!user?.id) return

      try {
        // Get user's IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipResponse.json()
        const userIP = ipData.ip

        // Check if IP is banned
        const { data: isBanned, error: banError } = await supabase.rpc('is_ip_banned', {
          p_ip_address: userIP
        })

        if (banError) {
          console.error('Error checking IP ban:', banError)
          return
        }

        if (isBanned) {
          toast.error('Your IP address has been banned. Please contact support.')
          // Sign out user (defensive)
          try {
            const { data: sessionData } = await supabase.auth.getSession()
            const hasSession = !!sessionData?.session
            if (hasSession) {
              const { error } = await supabase.auth.signOut()
              if (error) console.warn('supabase.signOut returned error:', error)
            } else {
              console.debug('No active session; skipping supabase.auth.signOut()')
            }
          } catch (innerErr) {
            console.warn('Error during sign-out (ignored):', innerErr)
          }

          useAuthStore.getState().logout()
          navigate('/auth', { replace: true })
          return
        }

        // Update user's last known IP
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('ip_address_history')
          .eq('id', user.id)
          .single()

        const ipHistory = currentProfile?.ip_address_history || []
        const newIPEntry = {
          ip: userIP,
          timestamp: new Date().toISOString()
        }

        // Add to history if not already present
        const updatedHistory = [...ipHistory, newIPEntry].slice(-10) // Keep last 10 IPs

        await supabase
          .from('user_profiles')
          .update({
            last_known_ip: userIP,
            ip_address_history: updatedHistory
          })
          .eq('id', user.id)
      } catch (error) {
        console.error('Error tracking IP:', error)
      }
    }

    if (user) {
      trackIP()
    }
  }, [user, navigate])

  // 🔹 Real-time Profile Updates (Debounced to prevent double renders)
  useDebouncedProfileUpdate(user?.id)

  // 🔹 Tab Visibility Change Handler
  useEffect(() => {
    if (!user?.id) return
 
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh data
        console.log('Tab became visible, refreshing data...')
        refreshProfile()
        eligibilityRefresh(user.id)
        // Dispatch global refetch event for all components
        window.dispatchEvent(new CustomEvent(APP_DATA_REFETCH_EVENT_NAME))
      }
    }
 
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id, refreshProfile, eligibilityRefresh])

  // 🔹 Scroll to top on route change
  useEffect(() => {
    const targets = [mainRef.current, document.scrollingElement, document.body]
    targets.forEach((el) => {
      if (el && typeof (el as HTMLElement).scrollTo === "function") {
        ;(el as HTMLElement).scrollTo({ top: 0, left: 0 })
      }
    })
  }, [location.pathname])

  // 🔹 Loading state
  const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
        Loading…
      </div>
    </div>
  );

  // 🔐 Route Guard
  const RequireAuth = () => {
    if (isLoading) return <LoadingScreen />;
    if (!user) return <Navigate to="/auth" replace />;
    if (
      profile &&
      profile.role !== "admin" &&
      (!profile.terms_accepted || !profile.court_recording_consent) &&
      location.pathname !== "/terms"
    ) {
      return <Navigate to="/terms" replace />;
    }
    if (
      profile?.application_required &&
      !profile?.application_submitted &&
      location.pathname !== "/application"
    ) {
      return <Navigate to="/application" replace />;
    }
    return <Outlet />;
  };

  console.log('🎨 App returning JSX...');
  return (
    <>
      {/* Global Error Banner */}
      <GlobalErrorBanner />

      {/* Global Loading Overlay */}
      <GlobalLoadingOverlay
        isVisible={globalLoading}
        message={loadingMessage}
        type="loading"
      />

      {/* Global Reconnecting Overlay */}
      <GlobalLoadingOverlay
        isVisible={isReconnecting}
        message={reconnectMessage}
        type="reconnecting"
      />

      {/* Global Error Overlay (for critical errors) */}
      <GlobalLoadingOverlay
        isVisible={!!error && !isReconnecting}
        message={error || ''}
        type="error"
        onRetry={retryLastAction}
      />


      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
        <div className="flex min-h-screen">
          {/* Desktop Sidebar */}
          {user && <div className="hidden md:block"><Sidebar /></div>}

          <div className="flex flex-col flex-1 min-h-screen w-full md:w-auto">
            {user && <Header />}
            {user && <AdminOfficerQuickMenu />}

            <main ref={mainRef} className="flex-1 overflow-y-auto bg-transparent safe-area-bottom">
              <ErrorBoundary>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                {/* 🚪 Public Routes */}
                <Route path="/" element={user ? <Home /> : <LandingPage />} />
                <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAgreement />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/payment-terms" element={<PaymentTerms />} />
                <Route path="/creator-agreement" element={<CreatorAgreement />} />
                <Route path="/tax-onboarding" element={<TaxOnboarding />} />
                <Route path="/verification" element={<VerificationPage />} />
                <Route path="/verification/complete" element={<VerificationComplete />} />
                <Route path="/ai-verification" element={<AIVerificationPage />} />
                <Route path="/account/earnings" element={<EarningsDashboard />} />
                 
                {/* Legal/Policy Pages */}
                <Route path="/legal" element={<PolicyCenter />} />
                <Route path="/legal/terms" element={<TermsOfServiceLegal />} />
                <Route path="/legal/refunds" element={<RefundPolicyLegal />} />
                <Route path="/legal/refund" element={<RefundPolicyLegal />} />
                <Route path="/legal/payouts" element={<PayoutPolicyLegal />} />
                <Route path="/legal/safety" element={<SafetyGuidelinesLegal />} />
                <Route path="/legal/creator-earnings" element={<CreatorEarnings />} />
                <Route path="/legal/gambling-disclosure" element={<GamblingDisclosure />} />
                <Route path="/legal/partner-program" element={<PartnerProgram />} />
                <Route path="/legal/trolls-night-rules" element={<TrollsNightRules />} />
                 
                {/* Safety Page (standalone) */}
                <Route path="/safety" element={<Safety />} />

                {/* 🔐 Protected Routes */}
                <Route element={<RequireAuth />}>
                  <Route path="/live" element={<Home />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/call/:roomId/:type/:userId" element={<Call />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/shop/:id" element={<ShopView />} />
                  <Route path="/inventory" element={<UserInventory />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/wall" element={<TrollCityWall />} />
                  <Route path="/treeds" element={<ReelFeed />} />
                  <Route path="/reels" element={<Navigate to="/treeds" replace />} />
                  <Route path="/profile/id/:userId" element={<Profile />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/trollstown" element={<TrollsTownPage />} />
                  
                  {/* 🌙 Trolls@Night Restricted Section */}
                  <Route path="/trolls-night/apply" element={<TrollsNightApplication />} />
                  <Route element={<TrollsNightGuard />}>
                    <Route path="/trolls-night" element={<TrollsNightPage />} />
                  </Route>

                  {/* 🎥 Streaming */}
                  <Route path="/go-live" element={<GoLive />} />
                  <Route path="/live/:streamId" element={<LivePage />} />
                  <Route path="/broadcast/:streamId" element={<Navigate to={`/live/${location.pathname.split('/').pop()}`} replace />} />
                  <Route path="/watch/:streamId" element={<Navigate to={`/live/${location.pathname.split('/').pop()}`} replace />} />
                  <Route path="/join" element={<JoinPage />} />
                  <Route path="/broadcast" element={<Navigate to="/go-live" replace />} />
                  <Route path="/broadcast-summary" element={<BroadcastSummary />} />
                  <Route path="/kick-fee" element={<KickFee />} />
                  <Route path="/ban-fee" element={<BanFee />} />
                  <Route path="/troll-court/session" element={<TrollCourtSession />} />
                  <Route path="/tromody" element={<TromodyShow />} />
                  <Route path="/tromody-show/broadcast" element={<TromodyShowBroadcast />} />
                  <Route path="/live/:streamId" element={<Navigate to="/live" replace />} />
                  <Route path="/interview/:sessionId" element={<InterviewRoom />} />
                  <Route path="/stream/:id" element={<Navigate to="/live" replace />} />
                  <Route path="/stream/:streamId" element={<Navigate to="/live" replace />} />
                  <Route path="/stream/:id/summary" element={<Navigate to="/live" replace />} />
                  <Route path="/stream-ended" element={<Navigate to="/live" replace />} />
                  <Route path="/stream-picture/:streamId" element={<StreamPicture />} />

                  {/* ⚖️ Court */}
                  <Route path="/troll-court" element={<TrollCourt />} />
                  <Route path="/court/:courtId" element={<CourtRoom />} />
                   
                  {/* 🎮 Multi-Box Streaming */}
                  <Route path="/command-battle-go-live" element={<CommandBattleGoLive />} />
                  <Route path="/troll-battle-setup" element={<TrollBattleSetup />} />
                   
                  {/* 👥 Empire Partner Program */}
                  <Route path="/empire-partner" element={<EmpirePartnerDashboard />} />
                  <Route path="/empire-partner/apply" element={<EmpirePartnerApply />} />


                  {/* 💳 Payment Methods */}
                  <Route path="/add-card" element={<AddCard />} />
                   
                  {/* 📝 Creator Onboarding */}
                  <Route path="/onboarding/creator" element={<CreatorOnboarding />} />

                  {/* 💰 Earnings & Coins */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/coins" element={<CoinStore />} />
                  <Route path="/coins/complete" element={<CoinsComplete />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/payouts/setup" element={<PayoutSetupPage />} />
                  <Route path="/payouts/request" element={<PayoutRequest />} />
                  <Route path="/payment/callback" element={<PaymentCallback />} />
                  <Route path="/earnings" element={<EarningsPage />} />
                  <Route path="/my-earnings" element={<MyEarnings />} />
                  <Route path="/cashout" element={<CashoutPage />} />
                  <Route path="/withdraw" element={<Withdraw />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/shop-partner" element={<ShopPartnerPage />} />
                  <Route path="/sell" element={<SellOnTrollCity />} />
                  <Route path="/seller/earnings" element={<ShopEarnings />} />
                  {/* Gift store routes removed */}

                  {/* 👨‍👩‍👧 Family */}
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/chat" element={<FamilyChatPage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />

                  {/* 🏰 Troll Family Ecosystem */}
                  <Route path="/family/lounge" element={<FamilyLounge />} />
                  <Route path="/family/wars-hub" element={<FamilyWarsHub />} />
                  <Route path="/family/leaderboard" element={<FamilyLeaderboard />} />
                  <Route path="/family/shop" element={<FamilyShop />} />

                  {/* 📝 Applications */}
                  <Route path="/apply" element={<Application />} />
                  <Route path="/application" element={<ApplicationPage />} />
                  <Route path="/apply/family" element={<FamilyApplication />} />
                  <Route path="/apply/officer" element={<OfficerApplication />} />
                  <Route path="/apply/troller" element={<TrollerApplication />} />
                  <Route path="/apply/lead-officer" element={<LeadOfficerApplication />} />

                  {/* 👮 Officer */}
                  <Route
                    path="/officer/onboarding"
                    element={<OfficerOnboarding />}
                  />
                  <Route
                    path="/officer/orientation"
                    element={<Orientation />}
                  />
                  <Route
                    path="/officer/orientation/quiz"
                    element={<OrientationQuiz />}
                  />
                  <Route
                    path="/lead-officer/review"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                        <LeadOfficerReview />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/lead-officer"
                    element={
                      <RequireLeadOrOwner>
                        <LeadOfficerDashboard />
                      </RequireLeadOrOwner>
                    }
                  />
                  <Route
                    path="/officer/lounge"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <TrollOfficerLounge />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/moderation"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <OfficerModeration />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/report/:id"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <ReportDetailsPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/scheduling"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <OfficerScheduling />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/stream"
                    element={
                      <RequireRole
                        roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER]}
                        requireActive={true}
                      >
                        <OfficerLoungeStream />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/dashboard"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/owc"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]} requireActive={true}>
                        <OfficerOWCDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/training"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerTrainingSimulator />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/training-progress"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerTrainingProgress />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/officer/payroll"
                    element={
                      <RequireRole roles={[UserRole.TROLL_OFFICER, UserRole.ADMIN]}>
                        <OfficerPayrollDashboard />
                      </RequireRole>
                    }
                  />

                  {/* 👑 Admin */}
                  <Route
                    path="/admin"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/store-debug"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <StoreDebug />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/payouts-mobile"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminPayoutMobile />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin-mobile"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <MobileAdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/officer-reports"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminOfficerReports />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/earnings"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminEarningsDashboard />
                      </RequireRole>
                    }
                  />
                    <Route
                      path="/admin/payments"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <PaymentsDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/economy"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <EconomyDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/tax-reviews"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <TaxReviewPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/tax/upload"
                      element={<TaxUpload />}
                    />
                    <Route
                      path="/admin/referrals"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <ReferralBonusPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/payouts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPayoutDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officers-live"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminLiveOfficersTracker />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/verified-users"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminVerifiedUsers />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/verification"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminVerificationReview />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/applications"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ApplicationsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/docs/policies"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPoliciesDocs />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/marketplace"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminMarketplace />
                        </RequireRole>
                      }
                    />
                    {systemManagementRoutes.map((route) => {
                      const Component = route.component
                      return (
                        <Route
                          key={route.id}
                          path={route.path}
                          element={
                            <RequireRole roles={route.roles ?? [UserRole.ADMIN]}>
                              <Component />
                            </RequireRole>
                          }
                        />
                      )
                    })}
                    <Route
                      path="/admin/ban-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <BanManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/role-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <RoleManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/media-library"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <MediaLibrary />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/chat-moderation"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ChatModeration />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/announcements"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <Announcements />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/export-data"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExportData />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/user-search"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <UserSearch />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/reports-queue"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReportsQueue />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/stream-monitor"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <StreamMonitorPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/grant-coins"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <GrantCoins />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/payment-logs"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <PaymentLogs />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/store-pricing"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <StorePriceEditor />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/finance"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminFinanceDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/create-schedule"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CreateSchedule />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officer-shifts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <OfficerShifts />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/empire-applications"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <EmpireApplicationsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/referral-bonuses"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReferralBonuses />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/control-panel"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ControlPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/test-diagnostics"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TestDiagnosticsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/reset-maintenance"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ResetMaintenance />
                        </RequireRole>
                      }
                    />
                  <Route
                    path="/admin/hr"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.HR_ADMIN]}>
                        <AdminHR />
                      </RequireRole>
                    }
                  />
                  <Route path="/rfc" element={<AdminRFC />} />
                  <Route
                    path="/changelog"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <Changelog />
                      </RequireRole>
                    }
                  />
                  {/* Account routes removed - Settings/Account pages no longer in sidebar */}
                </Route>

                {/* 🔙 Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
        </div>
      </div>

      {/* Profile setup modal */}
      <ProfileSetupModal
        isOpen={profileModalOpen}
        onSubmit={() => {}}
        loading={profileModalLoading}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* Toast system */}
      <Toaster
        position="top-right"
        duration={5000}
        toastOptions={{
          style: {
            background: "#2e1065",
            color: "#fff",
            border: "1px solid #22c55e",
          },
        }}
      />
    </div>
  </>)
}

function App() {
  return <AppContent />;
}

export default App;
