import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Heart, LayoutGrid, Wallet, User, LogOut, Settings, ChevronDown, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import type { ViewerTab } from '@/lib/xtrollz'

interface XTrollzHeaderProps {
  tab: ViewerTab
  onTabChange: (tab: ViewerTab) => void
  onOpenGoLive: () => void
  onOpenMessages: () => void
  profileImageUrl?: string
  displayName?: string
  isApprovedBroadcaster?: boolean
}

export default function XTrollzHeader({
  tab,
  onTabChange,
  onOpenGoLive,
  onOpenMessages,
  profileImageUrl,
  displayName,
  isApprovedBroadcaster = false,
}: XTrollzHeaderProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.troll_coins != null) setCoinBalance(data.troll_coins as number)
      })

    supabase.rpc('get_unread_notification_count', { p_user_id: user.id }).then(({ data }) => {
      if (typeof data === 'number') setUnreadCount(data)
    })
  }, [user?.id])

  const tabs: { key: ViewerTab; label: string; icon: typeof Radio }[] = [
    { key: 'live_now', label: 'Live Now', icon: Radio },
    { key: 'favorites', label: 'Favorite XTrollerz', icon: Heart },
    { key: 'categories', label: 'Categories', icon: LayoutGrid },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-2 text-lg font-black tracking-tight text-white hover:text-purple-300 transition-colors"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
                <Radio size={16} className="text-purple-300" />
              </span>
              XTROLLZ
            </button>

            <nav className="hidden items-center gap-1 md:flex">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => onTabChange(key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
                    tab === key
                      ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMessages}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
            >
              <MessageSquare size={16} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/wallet')}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-500/20 transition-colors"
            >
              <Wallet size={14} />
              {coinBalance != null ? coinBalance.toLocaleString() : '--'}
            </button>

            <button
              onClick={onOpenGoLive}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.35)] transition-colors"
            >
              <Radio size={14} />
              {isApprovedBroadcaster ? 'Go Live' : 'Apply & Go Live'}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-white hover:bg-white/10 transition-colors"
              >
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <User size={16} />
                )}
                <span className="hidden text-xs font-bold sm:inline">{displayName || 'Profile'}</span>
                <ChevronDown size={12} />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/10 bg-black/95 py-1 shadow-2xl backdrop-blur-xl">
                  <button
                    onClick={() => { setShowProfileMenu(false); navigate('/profile/setup') }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-white hover:bg-white/10"
                  >
                    <Settings size={14} /> Profile
                  </button>
                  <button
                    onClick={() => { setShowProfileMenu(false); navigate('/xtrollz/apply') }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-white hover:bg-white/10"
                  >
                    <Radio size={14} /> Apply & Go Live
                  </button>
                  <hr className="my-1 border-white/10" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-red-400 hover:bg-white/10"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 pb-2 md:hidden overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                tab === key
                  ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
