import { useEffect } from 'react'
import api from './lib/api' // Make sure this import exists

useEffect(() => {
  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null

      useAuthStore.setState({ user: currentUser })

      if (session?.user) {
        const adminCandidate = isAdminEmail(session.user.email)

        // Try admin fixer (doesn’t block loading)
        if (adminCandidate) {
          const cached = localStorage.getItem('admin-profile-cache')
          if (cached) {
            try {
              useAuthStore.setState({ profile: JSON.parse(cached), isAdmin: true })
            } catch {}
          }

          try {
            const result = await api.post('/auth/fix-admin-role')
            if (result?.success && result.profile) {
              useAuthStore.setState({ profile: result.profile, isAdmin: true })
              localStorage.setItem('admin-profile-cache', JSON.stringify(result.profile))
              return // Initialization complete
            }
          } catch (err) {
            console.warn('Admin fixer failed:', err)
          }
        }

        // Normal profile fetch
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileData) {
          useAuthStore.setState({ profile: profileData })
          if (profileData.role === 'admin') {
            useAuthStore.setState({ isAdmin: true })
          }
        } else {
          console.warn('No profile row found, forcing logout')
          await supabase.auth.signOut()
          useAuthStore.setState({ user: null, profile: null })
        }
      } else {
        useAuthStore.setState({ profile: null })
      }
    } catch (err) {
      console.error('Auth Init Error:', err)
    } finally {
      useAuthStore.setState({ isLoading: false }) // Always done
    }
  }

  initializeAuth()
}, [])
import { useEffect } from 'react'
import api from './lib/api' // Make sure this import exists

useEffect(() => {
  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null

      useAuthStore.setState({ user: currentUser })

      if (session?.user) {
        const adminCandidate = isAdminEmail(session.user.email)

        // Try admin fixer (doesn’t block loading)
        if (adminCandidate) {
          const cached = localStorage.getItem('admin-profile-cache')
          if (cached) {
            try {
              useAuthStore.setState({ profile: JSON.parse(cached), isAdmin: true })
            } catch {}
          }

          try {
            const result = await api.post('/auth/fix-admin-role')
            if (result?.success && result.profile) {
              useAuthStore.setState({ profile: result.profile, isAdmin: true })
              localStorage.setItem('admin-profile-cache', JSON.stringify(result.profile))
              return // Initialization complete
            }
          } catch (err) {
            console.warn('Admin fixer failed:', err)
          }
        }

        // Normal profile fetch
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileData) {
          useAuthStore.setState({ profile: profileData })
          if (profileData.role === 'admin') {
            useAuthStore.setState({ isAdmin: true })
          }
        } else {
          console.warn('No profile row found, forcing logout')
          await supabase.auth.signOut()
          useAuthStore.setState({ user: null, profile: null })
        }
      } else {
        useAuthStore.setState({ profile: null })
      }
    } catch (err) {
      console.error('Auth Init Error:', err)
    } finally {
      useAuthStore.setState({ isLoading: false }) // Always done
    }
  }

  initializeAuth()
}, [])
// src/App.tsx
import React, { useState, useEffect, Suspense, lazy } from 'react'
import { useLocation, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './lib/store'
import { supabase, isAdminEmail } from './lib/supabase'
import api from './lib/api'
import { Toaster } from 'sonner'

// COMPONENTS
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Home from './pages/Home'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import TermsAgreement from './pages/TermsAgreement'

// LAZY IMPORTS
const GoLive = lazy(() => import('./pages/GoLive'))
const StreamRoom = lazy(() => import('./pages/StreamRoom'))
const StreamSummary = lazy(() => import('./pages/StreamSummary'))
const Messages = lazy(() => import('./pages/Messages'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Trollifications = lazy(() => import('./pages/Trollifications'))
const Following = lazy(() => import('./pages/Following'))
const Application = lazy(() => import('./pages/Application'))
const TrollOfficerLounge = lazy(() => import('./pages/TrollOfficerLounge'))
const TrollFamily = lazy(() => import('./pages/TrollFamily'))
const TrollFamilyCity = lazy(() => import('./pages/TrollFamilyCity'))
const Profile = lazy(() => import('./pages/Profile'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const EarningsPayout = lazy(() => import('./pages/EarningsPayout'))
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'))
const TrollWheel = lazy(() => import('./pages/TrollWheel'))
const FamilyApplication = lazy(() => import('./pages/FamilyApplication'))
const OfficerApplication = lazy(() => import('./pages/OfficerApplication'))
const TrollerApplication = lazy(() => import('./pages/TrollerApplication'))
const CoinStore = lazy(() => import('./pages/CoinStore'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const Support = lazy(() => import('./pages/Support'))

function App() {
  const { user, profile, isLoading, setAuth, setProfile, setLoading, setIsAdmin } = useAuthStore()
  const location = useLocation()

  // 🔹 AUTH & PROFILE INITIALIZATION — REQUIRED!
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setAuth(session?.user || null, session)

        if (session?.user) {
          const isAdmin = isAdminEmail(session.user.email)

          if (isAdmin) {
            const cached = localStorage.getItem('admin-profile-cache')
            if (cached) {
              setProfile(JSON.parse(cached))
              setIsAdmin(true)
            }

            try {
              const result = await api.post('/auth/fix-admin-role')
              if (result?.success && result.profile) {
                setProfile(result.profile)
                setIsAdmin(true)
                localStorage.setItem('admin-profile-cache', JSON.stringify(result.profile))
                return
              }
            } catch {}
          }

          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profileData) {
            setProfile(profileData)
            if (profileData.role === 'admin') setIsAdmin(true)
          } else {
            await supabase.auth.signOut()
            setProfile(null)
          }
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth Init Error:', err)
      } finally {
        setLoading(false)
      }
    }
    initSession()
  }, [])

  // 🔹 LOADING SCREEN
  const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">Loading…</div>
    </div>
  )

  // 🔹 AUTH GUARD
  const RequireAuth = () => {
    if (isLoading) return <LoadingScreen />
    if (!user) return <Navigate to="/auth" replace />

    const needsTerms = profile && profile.terms_accepted === false && profile.role !== 'admin'
    if (needsTerms && location.pathname !== '/terms') return <Navigate to="/terms" replace />

    return <Outlet />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="flex min-h-screen">
        {user && <Sidebar />}
        <div className="flex flex-col flex-1 min-h-screen">
          {user && <Header />}

          <main className="flex-1 overflow-y-auto bg-[#121212]">
            <Suspense fallback={<LoadingScreen />}>
              <Routes>

                {/* 🚪 Auth Routes */}
                <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAgreement />} />

                {/* 🔒 Protected Routes */}
                <Route element={<RequireAuth />}>

                  {/* 🌍 Main */}
                  <Route path="/" element={<Home />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/profile/:username" element={<Profile />} />

                  {/* 💰 Economy */}
                  <Route path="/store" element={<CoinStore />} />
                  <Route path="/transactions" element={<TransactionHistory />} />
                  <Route path="/earnings" element={<EarningsPayout />} />

                  {/* 📺 Streaming */}
                  <Route path="/go-live" element={<GoLive />} />
                  <Route path="/stream/:streamId" element={<StreamRoom />} />
                  <Route path="/stream/:id/summary" element={<StreamSummary />} />

                  {/* 🎭 Community */}
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/wheel" element={<TrollWheel />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />

                  {/* 📝 Applications */}
                  <Route path="/apply" element={<Application />} />
                  <Route path="/apply/family" element={<FamilyApplication />} />
                  <Route path="/apply/officer" element={<OfficerApplication />} />
                  <Route path="/apply/troller" element={<TrollerApplication />} />

                  {/* 🛡 Officer */}
                  <Route
                    path="/officer/lounge"
                    element={profile?.role === 'admin' || profile?.role === 'troll_officer'
                      ? <TrollOfficerLounge />
                      : <Navigate to="/" replace />}
                  />

                  {/* 👑 Family */}
                  <Route path="/family" element={<TrollFamily />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />

                  {/* 👨‍💻 Admin */}
                  <Route
                    path="/admin"
                    element={profile?.role === 'admin'
                      ? <AdminDashboard />
                      : <Navigate to="/" replace />}
                  />
                </Route>

                {/* 🌫 Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>

      {/* 🔔 Toast system */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#2e1065',
            color: '#fff',
            border: '1px solid #22c55e',
          }
        }}
      />
    </div>
  )
}

export default App
