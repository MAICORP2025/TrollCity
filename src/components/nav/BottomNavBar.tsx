import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Video,
  Coins,
  Gavel,
  Scale,
  Map,
  Gamepad2,
  GraduationCap,
  LayoutGrid,
  Radio,
  Store,
  Users,
  Crown,
  BookOpen,
  Trophy,
  Vote,
  Shield,
  Star,
  Heart,
  MessageCircle,
  Search,
  Compass,
  HelpCircle,
  Activity,
  BarChart3,
  Settings,
  ScrollText,
  Wallet,
  Newspaper,
  Megaphone,
  ClipboardList,
  MonitorDot,
  Lock,
  Eye,
  Siren,
  DollarSign,
  Bell,
  User,
  LogOut,
  ChevronUp,
  X,
  Zap,
  Award,
  TrendingUp,
  Building2,
  Landmark,
  Waves,
  Package,
  Sparkles,
  Shuffle,
  Car,
  Briefcase,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useXPStore } from '@/stores/useXPStore';
import { supabase, UserRole } from '@/lib/supabase';
import { isPrideMonth } from '@/lib/prideMonth';
import { toast } from 'sonner';

/* ─── Role helpers (mirrored from Sidebar/BottomNav) ─── */
function useRoleChecks(profile: any) {
  const role = String(profile?.role || '');
  const trollRole = String(profile?.troll_role || '');

  const isAdmin =
    role === String(UserRole.ADMIN) ||
    trollRole === String(UserRole.ADMIN) ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    profile?.is_admin ||
    role === 'superadmin' ||
    trollRole === 'ceo' ||
    !!(profile as any)?.is_superadmin;

  const isSecretary =
    role === String(UserRole.SECRETARY) ||
    trollRole === String(UserRole.SECRETARY) ||
    !!(profile as any)?.is_secretary ||
    isAdmin;

  const isLead =
    role === String(UserRole.LEAD_TROLL_OFFICER) ||
    !!(profile as any)?.is_lead_officer ||
    trollRole === String(UserRole.LEAD_TROLL_OFFICER) ||
    isAdmin;

  const isOfficer =
    role === String(UserRole.TROLL_OFFICER) ||
    !!(profile as any)?.is_troll_officer ||
    trollRole === String(UserRole.TROLL_OFFICER) ||
    isLead ||
    isAdmin;

  const isPresident =
    role === String(UserRole.PRESIDENT) ||
    !!(profile as any)?.is_president ||
    trollRole === String(UserRole.PRESIDENT);

  const isBroadcaster =
    role === 'broadcaster' ||
    trollRole === 'broadcaster' ||
    !!(profile as any)?.is_broadcaster;

  return { isAdmin, isSecretary, isLead, isOfficer, isPresident, isBroadcaster, role, trollRole };
}

/* ─── Format helpers ─── */
function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ─── Profile Module (left section) ─── */
function ProfileModule({ collapsed }: { collapsed: boolean }) {
  const { user, profile } = useAuthStore();
  const { balances } = useCoins();
  const xpStore = useXPStore();
  const trollCoins = Number((balances as any)?.troll_coins ?? 0);
  const hypeCoins = Number((balances as any)?.hype_coins ?? 0);
  const crowns = Number((profile as any)?.crowns ?? 0);
  const trollmoods = Number((profile as any)?.trollmoods ?? 0);
  // Use XP store data, but fall back to auth profile (which is kept in sync via syncAuthProfile)
  const currentLevel = xpStore.level || profile?.level || 1;
  const currentXp = xpStore.xpTotal ?? profile?.xp ?? profile?.total_xp ?? 0;
  const nextXp = xpStore.xpToNext ?? profile?.next_level_xp ?? 1;
  const progress = xpStore.progress ?? (nextXp > 0 ? Math.min((currentXp / nextXp) * 100, 100) : 0);
  const [activeTheme, setActiveTheme] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      xpStore.fetchXP(user.id);
      xpStore.subscribeToXP(user.id);
      return () => {
        xpStore.unsubscribe();
      };
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setActiveTheme(null); return; }
    (async () => {
      try {
        const { data: stateData } = await supabase
          .from('user_broadcast_theme_state')
          .select('active_theme_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!stateData?.active_theme_id) { setActiveTheme(null); return; }
        const { data: theme } = await supabase
          .from('broadcast_background_themes')
          .select('slug, name, background_css, background_type, background_asset_url, preview_url, image_url, reactive_enabled, reactive_style')
          .eq('id', stateData.active_theme_id)
          .maybeSingle();
        setActiveTheme(theme || null);
      } catch {
        setActiveTheme(null);
      }
    })();
  }, [user?.id]);
  const displayName = profile?.display_name || profile?.username || 'Citizen';
  const avatarUrl = profile?.avatar_url;
  const prideActive = isPrideMonth();

  const hasActiveFrame = !!activeTheme;

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 px-2">
        <div className="relative">
          {avatarUrl ? (
            <>
              {hasActiveFrame && (
                <div className="absolute -inset-1 rounded-full opacity-60" style={{
                  background: activeTheme.background_css?.match(/linear-gradient\([^)]+\)/)?.[0]
                    || activeTheme.background_css?.match(/radial-gradient\([^)]+\)/)?.[0]
                    || 'none',
                  animation: activeTheme.reactive_style === 'pulse' ? 'pulse 4s ease-in-out infinite'
                    : activeTheme.reactive_style === 'gradient' ? 'gradientShift 8s linear infinite'
                    : undefined,
                  backgroundSize: '400% 400%',
                  filter: 'blur(4px)',
                }} />
              )}
              <img src={avatarUrl} alt="" className={`h-9 w-9 rounded-full object-cover ${hasActiveFrame ? '' : 'border-2 border-cyan-400/50'}`} />
            </>
          ) : (
            <>
              {hasActiveFrame && (
                <div className="absolute -inset-1 rounded-full opacity-60" style={{
                  background: activeTheme.background_css?.match(/linear-gradient\([^)]+\)/)?.[0]
                    || activeTheme.background_css?.match(/radial-gradient\([^)]+\)/)?.[0]
                    || 'none',
                  animation: activeTheme.reactive_style === 'pulse' ? 'pulse 4s ease-in-out infinite' : undefined,
                  backgroundSize: '400% 400%',
                  filter: 'blur(4px)',
                }} />
              )}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white ${hasActiveFrame ? '' : 'border-2 border-cyan-400/50 bg-gradient-to-br from-purple-600 to-cyan-500'}`} style={hasActiveFrame ? { background: 'linear-gradient(135deg, #6a00ff, #0096ff)' } : {}}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            </>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-950 text-[7px] font-black text-cyan-300 ring-1 ring-cyan-400/60">
            {currentLevel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      {/* Avatar */}
      {hasActiveFrame ? (
        <div className="relative shrink-0">
          <div className="absolute -inset-1.5 rounded-full opacity-70" style={{
            background: activeTheme.background_css?.match(/linear-gradient\([^)]+\)/)?.[0]
              || activeTheme.background_css?.match(/radial-gradient\([^)]+\)/)?.[0]
              || 'linear-gradient(90deg, #ff0057, #0096ff)',
            animation: activeTheme.reactive_style === 'pulse' ? 'pulse 4s ease-in-out infinite'
              : activeTheme.reactive_style === 'gradient' ? 'gradientShift 8s linear infinite'
              : activeTheme.reactive_style === 'aurora' ? 'auroraShift 12s ease-in-out infinite'
              : activeTheme.reactive_style === 'prismatic' ? 'prismaticShift 10s linear infinite'
              : activeTheme.reactive_style === 'stars' ? 'starsTwinkle 9s infinite'
              : undefined,
            backgroundSize: '400% 400%',
            filter: 'blur(6px)',
          }} />
          <div className="relative rounded-full p-[3px]" style={{
            background: activeTheme.background_css?.match(/linear-gradient\([^)]+\)/)?.[0]
              || activeTheme.background_css?.match(/radial-gradient\([^)]+\)/)?.[0]
              || 'linear-gradient(90deg, #ff0057, #0096ff)',
            backgroundSize: '400% 400%',
            animation: activeTheme.reactive_style === 'pulse' ? 'pulse 4s ease-in-out infinite'
              : activeTheme.reactive_style === 'gradient' ? 'gradientShift 8s linear infinite'
              : activeTheme.reactive_style === 'aurora' ? 'auroraShift 12s ease-in-out infinite'
              : activeTheme.reactive_style === 'prismatic' ? 'prismaticShift 10s linear infinite'
              : activeTheme.reactive_style === 'stars' ? 'starsTwinkle 9s infinite'
              : undefined,
          }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover md:h-11 md:w-11"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black text-white md:h-11 md:w-11">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-950 px-1 text-[8px] font-black text-cyan-300 ring-1 ring-cyan-400/60 md:h-5 md:min-w-[20px] md:text-[9px]">
            {currentLevel}
          </span>
        </div>
      ) : (
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className={`h-10 w-10 rounded-full object-cover ring-2 md:h-11 md:w-11 ${prideActive ? 'ring-pink-400/60' : 'ring-cyan-400/50'}`}
            />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black text-white ring-2 md:h-11 md:w-11 ${prideActive ? 'ring-pink-400/60' : 'ring-cyan-400/50'}`}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-950 px-1 text-[8px] font-black text-cyan-300 ring-1 ring-cyan-400/60 md:h-5 md:min-w-[20px] md:text-[9px]">
            {currentLevel}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="truncate text-[11px] font-black leading-tight text-white md:text-xs max-w-[120px]">{displayName}</p>
        <p className="text-[9px] font-bold text-cyan-300/80 md:text-[10px]">City Rank Lv. {currentLevel}</p>
        {/* Balances */}
        <div className="flex items-center gap-2 text-[9px] font-bold md:text-[10px]">
          <span className="flex items-center gap-0.5 text-yellow-300">
            <Coins className="h-2.5 w-2.5" /> {formatCoins(trollCoins)}
          </span>
          <span className="flex items-center gap-0.5 text-cyan-300">
            <Zap className="h-2.5 w-2.5" /> {formatCoins(hypeCoins)}
          </span>
          {crowns > 0 && (
            <span className="flex items-center gap-0.5 text-amber-300">
              <Crown className="h-2.5 w-2.5" /> {crowns}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Nav Button (center section) ─── */
interface NavButtonProps {
  icon: React.ElementType;
  label: string;
  to?: string;
  active?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'large';
  badge?: number;
}

function NavButton({ icon: Icon, label, to, active, highlight, onClick, size = 'normal', badge }: NavButtonProps) {
  const prideActive = isPrideMonth();
  const isLarge = size === 'large';

  const baseClasses = `
    group relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200
    ${isLarge ? 'h-14 w-14 md:h-20 md:w-20' : 'h-11 w-11 md:h-14 md:w-14'}
    ${active
      ? prideActive
        ? 'text-pink-300'
        : 'text-cyan-300'
      : 'text-slate-400 hover:text-white'
    }
    ${highlight
      ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
      : ''
    }
  `;

  const content = (
    <>
      <Icon className={`${isLarge ? 'h-5 w-5 md:h-7 md:w-7' : 'h-4 w-4 md:h-6 md:w-6'} transition-transform duration-200 group-hover:scale-110`} />
      <span className={`[font-size:7px] font-bold leading-none md:text-[9px] ${isLarge ? 'text-[8px] md:text-[11px]' : ''}`}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {active && (
        <span className={`absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full ${prideActive ? 'bg-gradient-to-r from-pink-400 to-cyan-400' : 'bg-cyan-400'}`} />
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={baseClasses} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={baseClasses} onClick={onClick}>
      {content}
    </button>
  );
}

/* ─── More Pages Panel ─── */
interface MorePagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageEntry {
  label: string;
  icon: React.ElementType;
  path: string;
  show?: boolean;
}

function MorePagesPanel({ isOpen, onClose }: MorePagesPanelProps) {
  const { user, profile, logout } = useAuthStore();
  const navigate = useNavigate_fixed();
  const { isAdmin, isSecretary, isLead, isOfficer, isPresident, isBroadcaster } = useRoleChecks(profile);
  const [search, setSearch] = useState('');
  const prideActive = isPrideMonth();

  const allPages = useMemo(() => {
    const pages: { category: string; items: PageEntry[] }[] = [
      {
        category: 'All Pages',
        items: [
          { label: 'Home', icon: Home, path: '/home' },
          { label: 'Search', icon: Search, path: '/search' },
          { label: 'Explore', icon: Compass, path: '/explore' },
          { label: 'Notifications', icon: Bell, path: '/notifications' },
          { label: 'Profile', icon: User, path: profile?.username ? `/profile/${profile.username}` : '/profile/setup' },
        ],
      },
      {
        category: 'Discover',
        items: [
          { label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
          { label: 'Marketplace', icon: Store, path: '/marketplace' },
          { label: 'Inventory', icon: Package, path: '/inventory' },
          { label: 'Wallet', icon: Wallet, path: '/wallet' },
          { label: 'Coin Store', icon: Coins, path: '/store' },
        ],
      },
      {
        category: 'Community',
        items: [
          { label: 'Neighborhood', icon: Map, path: '/neighborhood-map' },
          { label: 'HydroGaming', icon: Gamepad2, path: '/hytrogaming' },
          { label: 'Live Auctions', icon: Gavel, path: '/auctions' },
          { label: 'Voice Rooms', icon: Radio, path: '/voice-rooms' },
          { label: 'Battles', icon: Sparkles, path: '/troll-games' },
          { label: 'Organizations', icon: Building2, path: '/agencies' },
          { label: 'Troll Family', icon: Users, path: '/family/home' },
          { label: 'Pool', icon: Waves, path: '/pool' },
          { label: 'Troll Church', icon: BookOpen, path: '/church' },
          { label: 'Troll Match', icon: Heart, path: '/match' },
          { label: 'Troll Wheel', icon: Gamepad2, path: '/troll-wheel' },
        ],
      },
      {
        category: 'Government',
        items: [
          { label: 'Troll Court', icon: Scale, path: '/troll-court' },
          { label: 'City Laws & Fees', icon: FileText_M, path: '/home?tab=laws-fees' },
          { label: 'President Candidates', icon: Vote, path: '/home?tab=president' },
          { label: 'Elections', icon: ClipboardList, path: '/government' },
          ...(isOfficer || isSecretary || isAdmin
            ? [{ label: 'City Government', icon: Landmark as any, path: '/government' }]
            : []),
          ...(isOfficer
            ? [
                { label: 'Officer Dashboard', icon: LayoutGrid as any, path: '/officer/dashboard' },
                { label: 'Moderation', icon: Eye as any, path: '/officer/moderation' },
              ]
            : []),
          ...(isLead
            ? [{ label: 'Lead HQ', icon: Star as any, path: '/lead-officer' }]
            : []),
          ...(isSecretary || isAdmin
            ? [{ label: 'Secretary Console', icon: ScrollText as any, path: '/secretary' }]
            : []),
          ...(isPresident || isAdmin
            ? [{ label: 'President', icon: Crown as any, path: '/president' }]
            : []),
        ],
      },
      {
        category: 'Learning',
        items: [
          { label: 'Academy', icon: GraduationCap, path: '/academy' },
          { label: 'Courses', icon: BookOpen, path: '/academy/courses' },
          { label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
          { label: 'Tutorials', icon: Award, path: '/academy/tutorials' },
        ],
      },
      {
        category: 'Tools & Help',
        items: [
          { label: 'Go Live Guide', icon: Video, path: '/broadcast/setup' },
          { label: 'Help Center', icon: HelpCircle, path: '/support' },
          { label: 'Status', icon: Activity, path: '/status' },
          { label: 'Support', icon: Heart, path: '/support' },
          { label: 'Safety', icon: Shield, path: '/safety' },
          { label: 'Policies', icon: FileText_M, path: '/legal' },
        ],
      },
      ...(isAdmin
        ? [
            {
              category: 'Analytics & Stats',
              items: [
                { label: 'My Stats', icon: BarChart3, path: '/profile/stats' },
                { label: 'City Stats', icon: TrendingUp, path: '/admin' },
                { label: 'Admin Panel', icon: Settings, path: '/admin' },
                { label: 'Revenue Dashboard', icon: DollarSign, path: '/admin/earnings' },
                { label: 'Platform Analytics', icon: MonitorDot, path: '/admin/finance' },
              ],
            },
          ]
        : []),
      ...(isOfficer || isAdmin
        ? [
            {
              category: 'Moderation Center',
              items: [
                { label: 'Chat Moderation', icon: MessageCircle, path: '/admin/chat-moderation' },
                { label: 'Jail Management', icon: Lock, path: '/admin/jail-management' },
                { label: 'Reports Queue', icon: ClipboardList, path: '/admin/reports-queue' },
                { label: 'Stream Monitor', icon: MonitorDot, path: '/admin/stream-monitor' },
              ],
            },
          ]
        : []),
    ];

    return pages.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => item.show !== false),
    }));
  }, [isAdmin, isSecretary, isLead, isOfficer, isPresident, profile?.username]);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return allPages;
    const q = search.trim().toLowerCase();
    return allPages
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [allPages, search]);

  const handleNavigate = (path: string) => {
    onClose();
    if (path.startsWith('/home?tab=')) {
      const tab = path.split('=')[1];
      // Navigate to home with tab parameter
      navigate(`/home?tab=${tab}`);
    } else {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      onClose();
      navigate('/exit');
    } catch {
      toast.error('Error logging out');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed inset-x-0 bottom-0 z-[210] max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-white/10 ${prideActive ? 'bg-[#0a0520]/95' : 'bg-[#070b19]/95'} backdrop-blur-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)]`}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="text-lg font-black text-white">More Pages</h2>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                />
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              <div className="space-y-6">
                {filteredPages.map((cat) => (
                  <div key={cat.category}>
                    <h3 className={`mb-3 text-[10px] font-black uppercase tracking-[0.2em] ${prideActive ? 'text-pink-300/70' : 'text-cyan-300/70'}`}>
                      {cat.category}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                      {cat.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={`${cat.category}-${item.path}-${item.label}`}
                            onClick={() => handleNavigate(item.path)}
                            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
                          >
                            <ItemIcon className="h-5 w-5 text-slate-300" />
                            <span className="text-[10px] font-bold leading-tight text-slate-300">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Logout */}
              {user && (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Fixed icon references
function FileText_M(props: any) {
  return <ScrollText {...props} />;
}

// We need useNavigate from react-router-dom
import { useNavigate } from 'react-router-dom';

function useNavigate_fixed() {
  return useNavigate();
}

/* ─── Main Bottom Navigation Bar ─── */
export default function BottomNavBar() {
  const location = useLocation();
  const { user, profile } = useAuthStore();
  const { isBroadcaster } = useRoleChecks(profile);
  const [morePagesOpen, setMorePagesOpen] = useState(false);
  const prideActive = isPrideMonth();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <style>{`
        @keyframes rgbPulse {
          0% { border-color: rgb(255, 0, 0); }
          25% { border-color: rgb(0, 255, 0); }
          50% { border-color: rgb(0, 0, 255); }
          75% { border-color: rgb(255, 0, 255); }
          100% { border-color: rgb(255, 0, 0); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes auroraShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes prismaticShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes starsTwinkle {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .rgb-pulsing-nav-bar {
          animation: rgbPulse 3s infinite;
        }
      `}</style>
      {/* Bottom Navigation Bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[100] transition-all duration-300`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Main bar with RGB pulsing border */}
        <div className="rgb-pulsing-nav-bar relative border-2 bg-[#050715]/95 backdrop-blur-xl">
          <div className={`mx-auto flex items-center ${isMobile ? 'h-16 justify-around px-1' : 'h-20 max-w-[1920px] justify-between px-2 md:h-36 md:px-4'}`}>

            {/* LEFT: Go Live + Profile Module (desktop only) */}
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <Link
                to="/broadcast/setup"
                className={`group relative flex items-center justify-center gap-2 rounded-2xl transition-all duration-200 px-4 h-14 md:px-5 md:h-16 shrink-0 ${
                  isActive('/broadcast')
                    ? 'bg-gradient-to-br from-purple-500/40 to-cyan-500/40 text-white shadow-[0_0_24px_rgba(168,85,247,0.4)]'
                    : 'bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500 text-white shadow-[0_0_24px_rgba(168,85,247,0.5)] hover:shadow-[0_0_32px_rgba(168,85,247,0.6)]'
                }`}
              >
                <Video className="h-5 w-5 md:h-6 md:w-6 transition-transform duration-200 group-hover:scale-110" />
                <span className="text-xs font-bold leading-none md:text-sm">Go Live</span>
                {isActive('/broadcast') && (
                  <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-cyan-400" />
                )}
              </Link>
              <ProfileModule collapsed={false} />
            </div>

            {/* Mobile collapsed profile (left on mobile) */}
            {isMobile && (
              <div className="shrink-0">
                <ProfileModule collapsed={true} />
              </div>
            )}

            {/* CENTER: Nav buttons */}
            {isMobile ? (
              /* MOBILE: 5 tiles — Home, Go Live, Coins, Chats, More */
              <nav className="flex flex-1 items-center justify-around">
                <NavButton icon={Home} label="Home" to="/home" active={isActive('/home') || isActive('/')} size="large" />
                <NavButton icon={Video} label="Go Live" to="/broadcast/setup" active={isActive('/broadcast')} size="large" />
                <NavButton icon={Coins} label="Coins" to="/store" active={isActive('/store') || isActive('/coins')} size="large" />
                <NavButton icon={MessageCircle} label="Chats" to="/utromail" active={isActive('/utromail')} size="large" />
                <NavButton
                  icon={LayoutGrid}
                  label="More"
                  onClick={() => setMorePagesOpen(true)}
                  active={morePagesOpen}
                  size="large"
                />
              </nav>
            ) : (
              /* DESKTOP: Full nav row */
              <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide md:gap-1.5 lg:gap-2">
                <NavButton icon={Home} label="Home" to="/home" active={isActive('/home') || isActive('/')} />
                <NavButton icon={MessageCircle} label="Chats" to="/utromail" active={isActive('/utromail')} />
                <NavButton icon={Coins} label="Coins" to="/store" active={isActive('/store') || isActive('/coins')} />
                <NavButton icon={Gavel} label="Auctions" to="/auctions" active={isActive('/auctions')} />
                <NavButton icon={Scale} label="Court" to="/troll-court" active={isActive('/troll-court')} />
                <NavButton icon={Map} label="Neighborhood" to="/neighborhood-map" active={isActive('/neighborhood-map')} />
                <NavButton icon={Gamepad2} label="HydroGaming" to="/hytrogaming" active={isActive('/hytrogaming') || isActive('/gaming')} />
                <NavButton icon={GraduationCap} label="Academy" to="/academy" active={isActive('/academy')} />
                <NavButton icon={Wallet} label="Wallet" to="/wallet" active={isActive('/wallet')} />
                <NavButton icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} />
                <NavButton icon={Bell} label="Alerts" to="/notifications" active={isActive('/notifications')} />
                <NavButton icon={Search} label="Search" to="/search" active={isActive('/search')} />
                <NavButton icon={User} label="Profile" to={profile?.username ? `/profile/${profile.username}` : '/profile'} active={isActive('/profile')} />
                <NavButton icon={Users} label="Family" to="/family/home" active={isActive('/family')} />
                <NavButton icon={Store} label="Shop" to="/marketplace" active={isActive('/marketplace')} />
                <NavButton icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} />
                <NavButton icon={BookOpen} label="Church" to="/church" active={isActive('/church')} />
                <NavButton icon={Compass} label="Explore" to="/explore" active={isActive('/explore') || isActive('/live')} />
                <NavButton icon={Receipt} label="Transactions" to="/transactions" active={isActive('/transactions')} />
                <NavButton icon={Shuffle} label="Troll Wheel" to="/troll-wheel" active={isActive('/troll-wheel')} />
                <NavButton icon={Car} label="Cars" to="/ktauto" active={isActive('/ktauto')} />
                <NavButton icon={Briefcase} label="Careers" to="/careers" active={isActive('/careers')} />
                <NavButton icon={DollarSign} label="Earnings" to="/earnings" active={isActive('/earnings')} />
                <NavButton icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} />
              </nav>
            )}

            {/* RIGHT: More Pages (desktop only — mobile has it in the 5-tile row) */}
            <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
              <NavButton
                icon={LayoutGrid}
                label="More"
                onClick={() => setMorePagesOpen(true)}
                active={morePagesOpen}
              />
            </div>
          </div>
        </div>
      </div>

      {/* More Pages Slide-up Panel */}
      <MorePagesPanel isOpen={morePagesOpen} onClose={() => setMorePagesOpen(false)} />
    </>
  );
}
