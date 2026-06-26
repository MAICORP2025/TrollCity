import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Calendar,
  Ban,
  Car,
  CheckCircle,
  ChevronDown,
  Coins,
  CreditCard,
  FileText,
  Gavel,
  Heart,
  Home,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Palette,
  Phone,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserPlus,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { buildOGImageUrl } from '../lib/og';
import CreditScoreBadge from '../components/CreditScoreBadge';
import UserBadge from '../components/UserBadge';
import BackgroundCheckView from '../components/broadcast/BackgroundCheckView';
import { useCreditScore } from '../lib/hooks/useCreditScore';
import { getLevelName } from '../lib/xp';
import { useXPStore } from '@/stores/useXPStore';
import { PERK_CONFIG } from '@/lib/perkSystem';
import { canMessageAdmin, getGlowingTextStyle } from '@/lib/perkEffects';
import { PERKS as LEVEL_PERKS } from '@/config/levelSystem';
import { getProfileDisplayName } from '@/lib/profileDisplay';
import { GlowingUsernameColorPicker } from '../components/GlowingUsernameColorPicker';
import { cars } from '../data/vehicles';
import ProfileFeed from '../components/profile/ProfileFeed';
import ProfileWatchlist from '../components/profile/ProfileWatchlist';
import ProfileFrame from '../components/profile/ProfileFrame';
import ProfileReplays from '../components/profile/ProfileReplays';
import { useProfileFrameStore } from '../stores/useProfileFrameStore';
import type { ProfileFrame as ProfileFrameType } from '../config/profileFrames';

type InventoryState = {
  perks: any[];
  effects: any[];
  insurance: any[];
  callMinutes: any;
  homeListings: any[];
  vehicleListings: any[];
  marketplaceItems: any[];
  vehicles: any[];
  titlesAndDeeds: any[];
};

type TabOption = {
  key: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
};

const emptyInventory: InventoryState = {
  perks: [],
  effects: [],
  insurance: [],
  callMinutes: null,
  homeListings: [],
  vehicleListings: [],
  marketplaceItems: [],
  vehicles: [],
  titlesAndDeeds: [],
};

const shell = 'min-h-screen bg-slate-950 text-white pb-20 relative overflow-hidden';
const panel = 'rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 shadow-[0_0_60px_rgba(45,212,191,0.16),inset_0_0_30px_rgba(147,51,234,0.08)] backdrop-blur-2xl';
const innerPanel = 'rounded-3xl border border-cyan-300/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.08)]';
const goldText = 'bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-transparent';
const primaryButton = 'rounded-2xl bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 px-4 py-2 font-bold text-white shadow-[0_0_22px_rgba(45,212,191,0.30)] transition hover:scale-[1.02] hover:from-purple-600 hover:via-cyan-400 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton = 'rounded-2xl border border-cyan-300/20 bg-white/[0.04] px-4 py-2 font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:shadow-[0_0_18px_rgba(45,212,191,0.18)]';
const dangerButton = 'rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-2 font-semibold text-pink-200 transition hover:bg-red-600/20';
const inputClass = 'w-full rounded-2xl border border-cyan-300/15 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20';

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function StatCard({ label, value, onClick }: { label: string; value: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-white/10 bg-black/40 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-400/10"
    >
      <div className="text-2xl font-black text-white group-hover:text-cyan-100">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{label}</div>
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_24px_rgba(45,212,191,0.16)]">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className={`${innerPanel} p-8 text-center`}>
      <Icon className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
      <p className="font-bold text-zinc-200">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{body}</p>
    </div>
  );
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200 ${className}`}>{children}</span>;
}

function ProfileBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:32px_32px]" />
    </>
  );
}

function ProfileInner() {
  const { username, userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, profile: currentUserProfile } = useAuthStore();
  const refreshProfile = useAuthStore.getState().refreshProfile;
  const { fetchXP, subscribeToXP, unsubscribe } = useXPStore();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileLive, setIsProfileLive] = useState(false);
  const [liveStreamId, setLiveStreamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'social');
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [prideThemes, setPrideThemes] = useState<any[]>([]);
  const [prideLoading, setPrideLoading] = useState(false);
  const [equippingTheme, setEquippingTheme] = useState<string | null>(null);
  const [showInsuranceCard, setShowInsuranceCard] = useState<any | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [inventory, setInventory] = useState<InventoryState>(emptyInventory);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [messageCost, setMessageCost] = useState(0);
  const [viewCost, setViewCost] = useState(0);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [bannerNotificationsEnabled, setBannerNotificationsEnabled] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [equippedFrame, setEquippedFrame] = useState<ProfileFrameType | null>(null);
  const tabDropdownRef = useRef<HTMLDivElement | null>(null);
  const initialLoadRef = useRef(true);
  const prevProfileIdRef = useRef<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const viewerRole = useAuthStore.getState().profile?.troll_role || useAuthStore.getState().profile?.role || 'user';
  const memoizedProfileId = useMemo(() => profile?.id, [profile?.id]);
  const { data: creditData, loading: creditLoading } = useCreditScore(memoizedProfileId);

  const isOwnProfile = currentUser?.id === profile?.id;
  const canSeeFullProfile = isOwnProfile;
  const isAdminViewer = ['admin', 'troll_officer', 'lead_troll_officer'].includes(viewerRole);
  const isViewBlocked = !isOwnProfile && !isAdminViewer && isBlocked;
  const canUseBackground = isAdminViewer || ['secretary', 'prosecutor', 'attorney'].includes(viewerRole);

  const tabOptions: TabOption[] = [
    { key: 'social', label: 'Social', icon: MessageCircle, show: true },
    { key: 'recorded', label: 'Recorded', icon: Video, show: isOwnProfile },
    { key: 'watchlist', label: 'Watchlist', icon: Heart, show: isOwnProfile },
    { key: 'background', label: 'Background Check', icon: Shield, show: canUseBackground },
    { key: 'inventory', label: 'Inventory & Perks', icon: Package, show: canSeeFullProfile },
    { key: 'earnings', label: 'Earnings', icon: Coins, show: canSeeFullProfile },
    { key: 'purchases', label: 'Purchase History', icon: ShoppingBag, show: canSeeFullProfile },
    { key: 'admin_titles', label: 'Admin Titles', icon: FileText, show: canSeeFullProfile && isAdminViewer },
    { key: 'settings', label: 'Settings', icon: Settings, show: isOwnProfile },
  ];
  const visibleTabs = tabOptions.filter((tab) => tab.show);
  const activeTabLabel = visibleTabs.find((option) => option.key === activeTab)?.label || 'Social';

  const fetchInventory = useCallback(async (uid: string) => {
    try {
      // SAFETY: narrowed select columns to avoid fetching unnecessary data
      const [perksRes, insuranceUserRes, callRes, homesRes, vehicleListingsRes, marketplaceItemsRes, vehiclesRes, inventoryRes] = await Promise.all([
        supabase.from('user_perks').select('id,user_id,perk_id,purchased_at,metadata').eq('user_id', uid).order('purchased_at', { ascending: false }),
        supabase.from('user_insurances').select('id,user_id,insurance_id,is_active,expires_at,purchased_at,metadata').eq('user_id', uid).order('purchased_at', { ascending: false }),
        supabase.from('call_minutes').select('id,user_id,audio_minutes,video_minutes').eq('user_id', uid).maybeSingle(),
        supabase.from('properties').select('id,owner_user_id,title,price,created_at').eq('owner_user_id', uid).eq('is_listed', true).order('created_at', { ascending: false }),
        supabase.from('vehicle_listings').select('id,seller_id,title,price,created_at').eq('seller_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('marketplace_items').select('id,seller_id,title,price,status,created_at').eq('seller_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('user_vehicles').select('*, vehicles_catalog(*)').eq('user_id', uid).order('purchased_at', { ascending: false }),
        supabase.from('user_inventory').select('id,user_id,item_id,quantity,metadata').eq('user_id', uid),
      ]);

      let titlesAndDeedsData = inventoryRes.data || [];
      if (titlesAndDeedsData.length > 0) {
        try {
          const itemIds = titlesAndDeedsData.map((i: any) => i.item_id).filter(Boolean);
          if (itemIds.length > 0) {
            const { data: items } = await supabase.from('marketplace_items').select('*').in('id', itemIds);
            if (items) {
              const itemMap = new Map(items.map((item: any) => [item.id, item]));
              titlesAndDeedsData = titlesAndDeedsData.map((entry: any) => ({ ...entry, marketplace_item: itemMap.get(entry.item_id) }));
            }
          }
        } catch (err) {
          console.error('Error fetching marketplace item details:', err);
        }
      }

      let insuranceList = insuranceUserRes.data || [];
      try {
        const rawIds = insuranceList.map((p: any) => p.insurance_id).filter(Boolean);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuidIds = rawIds.filter((id: string) => uuidRegex.test(id));
        const slugIds = rawIds.filter((id: string) => !uuidRegex.test(id));
        const planMap = new Map<string, any>();

        if (uuidIds.length > 0) {
          const { data: plans } = await supabase.from('insurance_plans').select('id,name,description').in('id', Array.from(new Set(uuidIds)));
          (plans || []).forEach((plan: any) => planMap.set(plan.id, plan));
        }
        if (slugIds.length > 0) {
          const { data: options } = await supabase.from('insurance_options').select('id,name,description').in('id', Array.from(new Set(slugIds)));
          (options || []).forEach((option: any) => planMap.set(option.id, option));
        }

        insuranceList = insuranceList.map((row: any) => {
          const id = row.insurance_id;
          const plan = planMap.get(id);
          return {
            ...row,
            metadata: {
              ...(row.metadata || {}),
              plan_name: plan?.name || row.metadata?.plan_name || id,
              plan_description: plan?.description || row.metadata?.plan_description || 'Insurance Plan',
            },
          };
        });
      } catch (err) {
        console.error('Error fetching insurance plans:', err);
      }

      setInventory({
        perks: perksRes.data || [],
        effects: [],
        insurance: insuranceList,
        callMinutes: callRes.data || null,
        homeListings: homesRes.data || [],
        vehicleListings: vehicleListingsRes.data || [],
        marketplaceItems: marketplaceItemsRes.data || [],
        vehicles: vehiclesRes.data || [],
        titlesAndDeeds: titlesAndDeedsData || [],
      });
    } catch (e) {
      console.error('Error fetching inventory:', e);
    }
  }, []);

  const fetchEarnings = useCallback(async (uid: string) => {
    setEarningsLoading(true);
    try {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', uid)
        .gt('amount', 0)
        .in('type', ['gift_received', 'reward', 'purchase', 'admin_grant'])
        .order('created_at', { ascending: false })
        .limit(50);
      setEarnings(data || []);
    } catch (e) {
      console.error('Error fetching earnings:', e);
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const fetchPurchases = useCallback(async (uid: string) => {
    setPurchasesLoading(true);
    try {
      const { data } = await supabase.from('coin_transactions').select('*').eq('user_id', uid).lt('amount', 0).order('created_at', { ascending: false }).limit(50);
      setPurchases(data || []);
    } catch (e) {
      console.error('Error fetching purchases:', e);
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOwnProfile || !profile?.id) return;
    if (activeTab === 'earnings') fetchEarnings(profile.id);
    if (activeTab === 'purchases') fetchPurchases(profile.id);
  }, [activeTab, fetchEarnings, fetchPurchases, isOwnProfile, profile?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    const fetchProfile = async () => {
      let targetId: string | null = null;
      if (userId) targetId = userId;
      else if (currentUser?.id && !username) targetId = currentUser.id;

      const fetchKey = `${userId || ''}|${username || ''}|${currentUser?.id || ''}`;
      if (!initialLoadRef.current && lastFetchKeyRef.current === fetchKey) return;

      const isDifferentProfile = prevProfileIdRef.current !== targetId && !username;
      if (initialLoadRef.current || isDifferentProfile) setLoading(true);

      if (currentUser?.id) {
        fetchXP(currentUser.id);
        subscribeToXP(currentUser.id);
      }

      // SAFETY: narrowed select to columns actually used by the profile page
      const PROFILE_COLS = 'id,username,display_name,email,avatar_url,troll_coins,free_coins,reserved_troll_coins,cashout_coins,paid_coins,message_cost,profile_view_cost,organization_id,role,is_admin,level,xp,created_at,updated_at'
      let query = supabase.from('user_profiles').select(PROFILE_COLS);
      if (userId) query = query.eq('id', userId);
      else if (username) query = query.eq('username', username);
      else if (currentUser?.id) query = query.eq('id', currentUser.id);
      else {
        if (isMounted) setLoading(false);
        return;
      }

      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        console.error('Profile not found:', error);
        if (isMounted) setLoading(false);
        return;
      }

      prevProfileIdRef.current = data.id;
      initialLoadRef.current = false;

      const [followersRes, followingRes, postsRes, statsRes] = await Promise.all([
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', data.id),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', data.id),
        supabase.from('troll_posts').select('id', { count: 'exact', head: true }).eq('user_id', data.id),
        supabase.from('user_stats').select('level').eq('user_id', data.id).maybeSingle(),
      ]);

      if (statsRes.data?.level) data.level = statsRes.data.level;

      if (isMounted) {
        setProfile(data);
        setFollowersCount(followersRes.count || 0);
        setFollowingCount(followingRes.count || 0);
        setPostsCount(postsRes.count || 0);
        setEarnings([]);
        setPurchases([]);
        lastFetchKeyRef.current = fetchKey;

        if (currentUser?.id === data.id) {
          setMessageCost(data.message_cost || 0);
          setViewCost(data.profile_view_cost || 0);
          fetchInventory(data.id);
        } else {
          setInventory(emptyInventory);
        }

        // Load user's equipped profile frame
        try {
          const { data: frameData } = await supabase
            .from('user_profile_frames')
            .select('frame_id, is_equipped')
            .eq('user_id', data.id)
            .eq('is_equipped', true)
            .maybeSingle();
          if (frameData?.frame_id) {
            const { LAUNCH_FRAMES } = await import('../config/profileFrames');
            const frame = LAUNCH_FRAMES.find(f => f.id === frameData.frame_id);
            if (frame) {
              setEquippedFrame(frame);
            }
          }
        } catch { /* ignore frame load errors */ }

        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, fetchInventory, fetchXP, subscribeToXP, userId, username]);

  // SEO: Set profile meta tags and structured data
  useEffect(() => {
    if (!profile?.username) return

    const displayName = profile.display_name || profile.username
    const isLive = isProfileLive
    const liveText = isLive ? ' 🔴 LIVE' : ''
    const title = `${displayName} Live Streams & Posts | Troll City`
    const description = `Watch ${displayName}'s live streams, videos, posts, battles, and community activity on Troll City. ${isLive ? 'Currently streaming live!' : 'Follow to get notified when they go live.'}`
    const profileUrl = `${window.location.origin}/profile/${encodeURIComponent(profile.username)}`
    const avatarUrl = profile.avatar_url || `${window.location.origin}/preview-default.svg`
    const ogImageUrl = profile.username
      ? buildOGImageUrl({ kind: 'profile', username: profile.username })
      : avatarUrl

    // Set title and meta description
    document.title = title
    let metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) {
      metaDesc.setAttribute('content', description)
    } else {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      metaDesc.setAttribute('content', description)
      document.head.appendChild(metaDesc)
    }

    // Update Open Graph
    const updateOG = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="og:${prop}"]`)
      if (el) { el.setAttribute('content', content); return }
      el = document.createElement('meta')
      el.setAttribute('property', `og:${prop}`)
      el.setAttribute('content', content)
      document.head.appendChild(el)
    }
    updateOG('title', title)
    updateOG('description', description)
    updateOG('url', profileUrl)
    updateOG('type', 'profile')
    updateOG('image', ogImageUrl)

    // Update Twitter
    const updateTwitter = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="twitter:${name}"]`)
      if (el) { el.setAttribute('content', content); return }
      el = document.createElement('meta')
      el.setAttribute('name', `twitter:${name}`)
      el.setAttribute('content', content)
      document.head.appendChild(el)
    }
    updateTwitter('title', title)
    updateTwitter('description', description)
    updateTwitter('image', ogImageUrl)
    updateTwitter('card', 'summary_large_image')

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (canonical) {
      canonical.href = profileUrl
    } else {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      canonical.setAttribute('href', profileUrl)
      document.head.appendChild(canonical)
    }

    // JSON-LD structured data (ProfilePage + Person)
    const existingSchema = document.querySelector('#profile-schema')
    if (existingSchema) existingSchema.remove()

    const schemaScript = document.createElement('script')
    schemaScript.id = 'profile-schema'
    schemaScript.type = 'application/ld+json'
    schemaScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      'name': `${displayName} on Troll City`,
      'description': description,
      'url': profileUrl,
      'mainEntity': {
        '@type': 'Person',
        'name': displayName,
        'url': profileUrl,
        'image': avatarUrl,
        ...(isLive && {
          'subjectOf': {
            '@type': 'VideoObject',
            'name': `${displayName} is LIVE on Troll City`,
            'url': liveStreamId ? `${window.location.origin}/live/${liveStreamId}` : profileUrl,
            'thumbnailUrl': avatarUrl,
            'isLiveBroadcast': true
          }
        })
      }
    })
    document.head.appendChild(schemaScript)

    return () => {
      const schema = document.querySelector('#profile-schema')
      if (schema) schema.remove()
    }
  }, [profile?.username, profile?.display_name, profile?.avatar_url, isProfileLive, liveStreamId])

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`profile-updates-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${profile.id}`,
        },
        async (payload) => {
          const newProfile = payload.new as any;

          setProfile((prev: any) => ({
            ...prev,
            ...newProfile,
          }));

          if (currentUser?.id === newProfile.id) {
            await refreshProfile();
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [profile?.id, currentUser?.id, refreshProfile]);

  useEffect(() => {
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.error('Error unsubscribing from XP store:', err);
      }
    };
  }, [unsubscribe]);

  useEffect(() => {
    if (!profile?.id) return;
    let isMounted = true;

    const checkLiveStatus = async () => {
      try {
        const { data } = await supabase.from('streams').select('id').eq('broadcaster_id', profile.id).eq('is_live', true).maybeSingle();
        if (isMounted) {
          setIsProfileLive(!!data);
          setLiveStreamId(data?.id || null);
        }
      } catch (err) {
        console.error('Error checking live status:', err);
      }
    };

    checkLiveStatus();
    const channel = supabase
      .channel(`profile-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `broadcaster_id=eq.${profile.id}` }, checkLiveStatus)
      .subscribe();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [profile?.id]);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!currentUser || !profile?.id || currentUser.id === profile.id) return;
      const { data } = await supabase.from('user_follows').select('*').eq('follower_id', currentUser.id).eq('following_id', profile.id).maybeSingle();
      setIsFollowing(!!data);
    };
    checkFollowStatus();
  }, [currentUser, profile?.id]);

  // Check block status: either direction
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!currentUser || !profile?.id || currentUser.id === profile.id) {
        setIsBlocked(false);
        return;
      }
      // Check if current user blocked the profile owner
      const { data: iBlocked } = await supabase.from('user_blocks')
        .select('id').eq('blocker_id', currentUser.id).eq('blocked_id', profile.id).maybeSingle();
      // Check if profile owner blocked current user
      const { data: blockedMe } = await supabase.from('user_blocks')
        .select('id').eq('blocker_id', profile.id).eq('blocked_id', currentUser.id).maybeSingle();
      setIsBlocked(!!iBlocked || !!blockedMe);
    };
    checkBlockStatus();
  }, [currentUser, profile?.id]);

  useEffect(() => {
    if (isOwnProfile && profile?.announcements_enabled !== undefined) setAnnouncementsEnabled(profile.announcements_enabled);
    if (isOwnProfile && profile?.banner_notifications_enabled !== undefined) setBannerNotificationsEnabled(profile.banner_notifications_enabled);
    // Load owned Pride themes for quick equip on profile
    (async () => {
      if (!isOwnProfile || !currentUser) return;
      setPrideLoading(true);
      try {
        const { data } = await supabase
          .from('v_broadcast_themes_for_user')
          .select('*')
          .eq('owned', true)
          .order('is_active_for_user', { ascending: false });
        // Filter client-side for Pride-themed frames (by slug or name)
        const pride = (data || []).filter((t: any) => {
          const s = (t.slug || '').toLowerCase();
          const n = (t.name || '').toLowerCase();
          return s.includes('pride') || n.includes('pride');
        });
        setPrideThemes(pride);
      } catch (err) {
        console.error('Failed to load pride themes:', err);
      } finally {
        setPrideLoading(false);
      }
    })();
  }, [isOwnProfile, profile?.announcements_enabled, profile?.banner_notifications_enabled]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) setIsTabDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabSelect = (tabKey: string) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
    setIsTabDropdownOpen(false);
  };

  const handleClearCacheReload = () => {
    try {
      if (currentUser?.id) {
        [`tc-profile-${currentUser.id}`, `trollcity_car_${currentUser.id}`, `trollcity_owned_vehicles_${currentUser.id}`, `trollcity_car_insurance_${currentUser.id}`, `trollcity_vehicle_condition_${currentUser.id}`, `trollcity_home_owned_${currentUser.id}`].forEach((key) => localStorage.removeItem(key));
      }
      localStorage.removeItem('pwa-installed');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  const handleFollow = async () => {
    if (!currentUser) return toast.error('Please login to follow users');
    if (currentUser.id === profile.id) return toast.error('You cannot follow yourself');

    if (isFollowing) {
      const { error } = await supabase.from('user_follows').delete().match({ follower_id: currentUser.id, following_id: profile.id });
      if (error) return toast.error('Failed to unfollow user');
      setIsFollowing(false);
      setFollowersCount((prev) => Math.max(0, prev - 1));
      toast.success(`Unfollowed ${profile.username}`);
    } else {
      const { error } = await supabase.from('user_follows').insert({ follower_id: currentUser.id, following_id: profile.id });
      if (error) return toast.error('Failed to follow user');
      setIsFollowing(true);
      setFollowersCount((prev) => prev + 1);
      toast.success(`Followed ${profile.username}`);
    }
  };

  const handleMessage = async () => {
    if (!currentUser) return toast.error('Please login to message users');

    const isAdmin = profile.role === 'admin' || profile.is_admin;
    if (isAdmin) {
      const { data: followedByData } = await supabase.from('user_follows').select('*').eq('follower_id', profile.id).eq('following_id', currentUser.id).maybeSingle();
      const hasPerk = await canMessageAdmin(currentUser.id);
      if (!followedByData && !hasPerk) return toast.error("You need the 'Message Admin' perk or be followed by the Admin to message them!");
    }

    navigate(`/utromail?recipientId=${encodeURIComponent(profile.id)}`);
  };

  const handleUpdateCosts = async () => {
    if (!currentUser || currentUser.id !== profile.id) return;
    setSavingPreferences(true);
    try {
      const { error } = await supabase.rpc('update_profile_costs', { p_message_cost: messageCost, p_view_cost: viewCost });
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, message_cost: messageCost, profile_view_cost: viewCost }));
      toast.success('Profile costs updated successfully');
    } catch (error) {
      console.error('Error updating costs:', error);
      toast.error('Failed to update profile costs');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    if (!window.confirm('Are you sure you want to PERMANENTLY delete your account? This action cannot be undone and you will lose all progress, coins, and items.')) return;
    const confirmUsername = window.prompt(`Please type your username "${currentUserProfile?.username}" to confirm deletion:`);
    if (confirmUsername !== currentUserProfile?.username) return toast.error('Username does not match. Deletion cancelled.');

    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      toast.success('Account deleted successfully');
      handleClearCacheReload();
      navigate('/auth');
    } catch (e: any) {
      console.error('Delete account error:', e);
      toast.error(e?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleRepurchasePerk = async (perk: any) => {
    if (!currentUser || currentUser.id !== profile.id) return;
    const config = PERK_CONFIG[perk.perk_id as keyof typeof PERK_CONFIG];
    if (!config) return toast.error('Perk configuration not found');
    if ((profile.troll_coins || 0) < config.cost) return toast.error(`Insufficient coins. Need ${config.cost.toLocaleString()}`);

    const { error } = await supabase.rpc('shop_buy_perk', {
      p_user_id: currentUser.id,
      p_perk_id: perk.perk_id,
      p_cost: config.cost,
      p_duration_minutes: config.duration_minutes,
      p_metadata: {
        perk_name: config.name,
        description: config.description,
        perk_type: config.type,
        base_cost: config.cost,
        final_cost: config.cost,
        duration_minutes: config.duration_minutes,
      },
    });

    if (error) {
      console.error('Repurchase error:', error);
      return toast.error('Failed to repurchase perk');
    }
    if (perk.perk_id === 'perk_rgb_username') await refreshProfile();
    toast.success('Perk repurchased successfully!');
    fetchInventory(currentUser.id);
  };

  const togglePerk = async (perkId: string, isActive: boolean) => {
    if (!currentUser || currentUser.id !== profile.id) return;
    const { error } = await supabase.rpc('toggle_user_perk', { p_perk_id: perkId, p_is_active: !isActive });
    if (error) {
      console.error('Toggle perk error:', error);
      return toast.error('Failed to update perk');
    }
    const perk = inventory.perks.find((p) => p.id === perkId);
    if (perk?.perk_id === 'perk_rgb_username') await refreshProfile();
    toast.success(`Perk ${!isActive ? 'activated' : 'deactivated'}`);
    fetchInventory(currentUser.id);
  };

  const toggleAnnouncements = async () => {
    if (!currentUser) return;
    setSavingPreferences(true);
    try {
      const newValue = !announcementsEnabled;
      const { error } = await supabase.from('user_profiles').update({ announcements_enabled: newValue }).eq('id', currentUser.id);
      if (error) throw error;
      setAnnouncementsEnabled(newValue);
      toast.success(newValue ? 'Announcements enabled' : 'Announcements disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const toggleBannerNotifications = async () => {
    if (!currentUser) return;
    setSavingPreferences(true);
    try {
      const newValue = !bannerNotificationsEnabled;
      const { error } = await supabase.from('user_profiles').update({ banner_notifications_enabled: newValue }).eq('id', currentUser.id);
      if (error) throw error;
      setBannerNotificationsEnabled(newValue);
      toast.success(newValue ? 'Banner notifications enabled' : 'Banner notifications disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('logout_requested', 'true');
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('signOut error:', error);
      await useAuthStore.getState().logout();
      localStorage.clear();
      const introSeen = sessionStorage.getItem('trollIntroSeen');
      sessionStorage.clear();
      if (introSeen) sessionStorage.setItem('trollIntroSeen', introSeen);
      toast.success('Logged out');
      navigate('/exit', { replace: true });
    } catch (e: any) {
      console.error('Logout error:', e);
      toast.error(e?.message || 'Failed to log out');
      navigate('/exit', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className={shell}>
        <ProfileBackdrop />
        <div className="relative flex min-h-screen items-center justify-center">
          <div className={`${panel} px-8 py-6 text-center`}>
            <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-cyan-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Loading Profile Command Center</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={shell}>
        <div className="relative flex min-h-screen items-center justify-center p-6">
          <div className={`${panel} max-w-md p-8 text-center`}>
            <h2 className="text-2xl font-black text-white">User not found</h2>
            <p className="mt-2 text-zinc-400">The user you are looking for does not exist.</p>
            <button onClick={() => navigate('/')} className={`${primaryButton} mt-6`}>Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (isViewBlocked) {
    return (
      <div className={shell}>
        <ProfileBackdrop />
        <div className="relative flex min-h-screen items-center justify-center p-6">
          <div className={`${panel} max-w-md p-8 text-center`}>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-red-500/30 bg-red-950/30">
              <Ban className="h-10 w-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-white">User Unavailable</h2>
            <p className="mt-2 text-zinc-400">You cannot view this profile because you have been blocked or have blocked this user.</p>
            <button onClick={() => navigate('/')} className={`${primaryButton} mt-6`}>Go Home</button>
          </div>
        </div>
      </div>
    );
  }

  const hasRgbUsername = profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date();
  const glowingStyle = !hasRgbUsername && profile?.glowing_username_color ? getGlowingTextStyle(profile.glowing_username_color) : undefined;
  const isGold = profile?.is_gold || false;
  const usernameStyle = isGold && profile?.username_style === 'gold' ? { color: '#FFD700', textShadow: '0 0 12px #FFD700' } : glowingStyle;
  const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`;
  const cleanBio = (profile.bio || '').replace(/(https?:\/\/[^\s]+)/g, '').trim();
  const levelName = getLevelName(profile?.level || 1);

  const renderSocial = () => (
    <div className="space-y-6">
      <div className={`${innerPanel} overflow-hidden p-1`}>
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-black text-white">City Wall</h3>
          <p className="text-sm text-zinc-500">Posts, updates, and profile activity.</p>
        </div>
        <div className="p-4 sm:p-5">
          <ProfileFeed userId={profile.id} />
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-8">
      <section>
        <SectionHeader icon={Zap} title="Active Perks" subtitle="Premium powers and boosted profile abilities" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {inventory.perks.map((perk) => {
            const isExpired = perk.expires_at && new Date(perk.expires_at) < new Date();
          const config = PERK_CONFIG[perk.perk_id as keyof typeof PERK_CONFIG];
          const levelPerk = LEVEL_PERKS.find((item) => item.id === perk.perk_id);
          const fallbackName = perk.perk_id ? perk.perk_id.replace(/^perk_/, '').replace(/_/g, ' ').toUpperCase() : 'Unknown Perk';
          const displayName = config?.name || perk.metadata?.perk_name || levelPerk?.label || fallbackName;
          const description = config?.description || perk.metadata?.perk_description || perk.metadata?.description || levelPerk?.description || 'Premium account perk.';
          return (
            <div key={perk.id} className={`${innerPanel} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-white">{displayName}</h4>
                  <p className="mt-1 text-sm text-zinc-400">{description}</p>
                  {perk.metadata?.source === 'level_unlock' && perk.metadata?.level_required && (
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-cyan-300">Level Reward • Level {perk.metadata.level_required}</p>
                  )}
                </div>
                  <Pill className={isExpired ? 'border-red-500/30 text-pink-300' : perk.is_active ? 'border-emerald-500/30 text-emerald-300' : 'text-zinc-400'}>{isExpired ? 'EXPIRED' : perk.is_active ? 'ACTIVE' : 'INACTIVE'}</Pill>
                </div>
                <p className="mt-4 text-xs text-zinc-500">Expires: {formatDateTime(perk.expires_at)}</p>
                {isOwnProfile && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!isExpired && <button onClick={() => togglePerk(perk.id, perk.is_active)} className={secondaryButton}>{perk.is_active ? 'Deactivate' : 'Activate'}</button>}
                    {perk.perk_id === 'perk_global_highlight' && perk.is_active && <button onClick={() => setShowColorPickerModal(true)} className={primaryButton}><Palette className="mr-2 inline h-4 w-4" /> Choose Color</button>}
                    {(isExpired || !perk.is_active) && <button onClick={() => handleRepurchasePerk(perk)} className={primaryButton}><Coins className="mr-2 inline h-4 w-4" /> Repurchase</button>}
                  </div>
                )}
              </div>
            );
          })}
          {inventory.perks.length === 0 && <EmptyState icon={Zap} title="No perks found" body="Purchased profile perks will appear here." />}
        </div>
      </section>

      <section>
        <SectionHeader icon={FileText} title="Titles & Deeds" subtitle="Owned city assets, titles, and official documents" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {inventory.titlesAndDeeds.map((item: any) => {
            const title = item.marketplace_item?.title || item.metadata?.title || item.metadata?.name || 'Unknown Item';
            const description = item.marketplace_item?.description || item.metadata?.description || 'No description available';
            const imageUrl = item.marketplace_item?.image_url || item.metadata?.image_url || item.metadata?.image;
            return (
              <div key={item.id} className={`${innerPanel} flex gap-4 p-5`}>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
                  {imageUrl ? <img src={imageUrl} alt={title} className="h-full w-full object-cover" /> : <FileText className="h-8 w-8 text-cyan-300" />}
                </div>
                <div>
                  <h4 className="font-black text-white">{title}</h4>
                  <p className="mt-1 text-sm text-zinc-400">{description}</p>
                  <Pill className="mt-3 border-cyan-300/30 text-cyan-100">{item.marketplace_item?.type || item.metadata?.type || 'item'}</Pill>
                </div>
              </div>
            );
          })}
          {inventory.titlesAndDeeds.length === 0 && <EmptyState icon={FileText} title="No titles or deeds" body="Owned documents and titles will appear here." />}
        </div>
      </section>

      <section>
        <SectionHeader icon={Phone} title="Call Minutes" subtitle="Communication minutes for audio and video calls" />
        <div className={`${innerPanel} grid grid-cols-2 gap-4 p-5`}>
          <StatCard label="Audio Minutes" value={(inventory.callMinutes?.audio_minutes || 0).toLocaleString()} />
          <StatCard label="Video Minutes" value={(inventory.callMinutes?.video_minutes || 0).toLocaleString()} />
        </div>
      </section>

      {/* Entrance Effects removed */}

      <section>
        <SectionHeader icon={Shield} title="Troll Protection" subtitle="Insurance and protection plans" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {inventory.insurance.map((plan) => (
            <div key={plan.id} className={`${innerPanel} p-5`}>
              <h4 className="font-black text-white">{plan.metadata?.package_name || plan.metadata?.insurance_name || plan.metadata?.plan_name || 'Protection Plan'}</h4>
              <p className="mt-2 text-sm text-zinc-400">{plan.metadata?.plan_description || 'Active Troll City protection plan.'}</p>
              <p className="mt-3 text-xs text-zinc-500">Expires: {formatDateTime(plan.expires_at)}</p>
            </div>
          ))}
          {inventory.insurance.length === 0 && <EmptyState icon={Shield} title="No protection plans" body="Active protection plans will appear here." />}
        </div>
      </section>

      <section>
        <SectionHeader icon={Car} title="Vehicles" subtitle="Garage, active vehicle, and insurance cards" />
        <div className="space-y-4">
          {inventory.vehicles.map((v: any) => {
            const catalog = v.vehicles_catalog;
            let legacyCarConfig = null;
            if (!catalog) {
              if (v.customization_json?.car_model_id) legacyCarConfig = cars.find((c) => c.id === v.customization_json.car_model_id);
              else if (v.car_id && !Number.isNaN(Number(v.car_id))) legacyCarConfig = cars.find((c) => c.id === Number(v.car_id));
            }
            const displayName = catalog?.name || legacyCarConfig?.name || `Vehicle #${String(v.id).slice(0, 8)}`;
            const displayImage = catalog?.image || legacyCarConfig?.image || null;
            const displayTier = catalog?.tier || legacyCarConfig?.tier || null;
            const isInsured = v.insurance_expiry && new Date(v.insurance_expiry) > new Date();
            const isActive = String(profile.active_vehicle) === String(v.id);

            return (
              <div key={v.id} className={`${innerPanel} flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between ${isActive ? 'border-emerald-400/40 bg-emerald-400/10' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-2">
                    {displayImage ? <img src={displayImage} alt={displayName} className="h-full w-full object-contain" /> : <Car className="text-zinc-600" />}
                    {isActive && <CheckCircle className="absolute right-2 top-2 h-4 w-4 text-emerald-300" />}
                  </div>
                  <div>
                    <h4 className="font-black text-white">{displayName}</h4>
                    {displayTier && <p className="text-sm text-zinc-400">{displayTier} Class</p>}
                    <Pill className={isInsured ? 'mt-2 border-emerald-500/30 text-emerald-300' : 'mt-2 text-zinc-400'}>{isInsured ? 'Insured' : 'No Insurance'}</Pill>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isInsured && <button onClick={() => setShowInsuranceCard({ user: profile, vehicle: v, config: catalog || legacyCarConfig })} className={secondaryButton}><CreditCard className="mr-2 inline h-4 w-4" /> View Card</button>}
                  {isOwnProfile && <button onClick={() => navigate('/ktauto')} className={primaryButton}>Manage</button>}
                </div>
              </div>
            );
          })}
          {inventory.vehicles.length === 0 && <EmptyState icon={Car} title="No vehicles in garage" body="Purchased vehicles will appear here." />}
        </div>
      </section>

      {inventory.homeListings.length > 0 && (
        <section>
          <SectionHeader icon={Home} title="Homes For Sale" />
          <div className="space-y-3">
            {inventory.homeListings.map((home: any) => (
              <div key={home.id} className={`${innerPanel} flex items-center justify-between gap-4 p-5`}>
                <div><h4 className="font-black text-white">Home {String(home.id).slice(0, 6).toUpperCase()}{home.is_starter ? ' • Starter' : ''}</h4>{home.ask_price && <p className="text-sm text-zinc-400">Listed for {Number(home.ask_price).toLocaleString()} TrollCoins</p>}</div>
                {isOwnProfile && <button onClick={() => navigate('/neighborhood-setup')} className={secondaryButton}>Manage</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {inventory.vehicleListings.length > 0 && (
        <section>
          <SectionHeader icon={Car} title="Vehicle Listings" />
          <div className="space-y-3">
            {inventory.vehicleListings.map((listing: any) => {
              const vehicle = cars.find((c) => c.id === listing.vehicle_id);
              const name = listing.metadata?.vehicle_name || vehicle?.name || `Vehicle #${listing.vehicle_id}`;
              return (
                <div key={listing.id} className={`${innerPanel} flex items-center justify-between gap-4 p-5`}>
                  <div><h4 className="font-black text-white">{name}</h4><p className="text-sm text-zinc-400">{listing.listing_type === 'auction' ? 'Auction starting at ' : 'Listed for '}{Number(listing.price).toLocaleString()} TrollCoins</p></div>
                  {isOwnProfile && <button onClick={() => navigate(listing.listing_type === 'auction' ? '/auctions' : '/ktauto')} className={secondaryButton}>Manage Listing</button>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {inventory.marketplaceItems.length > 0 && (
        <section>
          <SectionHeader icon={ShoppingBag} title="Marketplace Listings" />
          <div className="space-y-3">
            {inventory.marketplaceItems.map((listing: any) => (
              <div key={listing.id} className={`${innerPanel} flex items-center justify-between gap-4 p-5`}>
                <div>
                  <h4 className="font-black text-white">{listing.title}</h4>
                  <p className="text-sm text-zinc-400">{listing.category} • {listing.condition}</p>
                </div>
                <p className="font-black text-cyan-300">{listing.price_coins ? `${listing.price_coins.toLocaleString()} coins` : ''}{listing.price_usd && listing.price_coins ? ' / ' : ''}{listing.price_usd ? `$${listing.price_usd}` : ''}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const renderLedger = (type: 'earnings' | 'purchases') => {
    const isEarnings = type === 'earnings';
    const rows = isEarnings ? earnings : purchases;
    const loadingRows = isEarnings ? earningsLoading : purchasesLoading;
    return (
      <div className="space-y-6">
        <div className={`${panel} flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">{isEarnings ? 'Total Earned' : 'Total Spent'}</p>
            <h3 className={`mt-2 flex items-center gap-2 text-4xl font-black ${isEarnings ? 'text-emerald-300' : 'text-pink-300'}`}><Coins className="h-8 w-8" /> {Number(isEarnings ? profile.total_earned_coins || 0 : profile.total_spent_coins || 0).toLocaleString()}</h3>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/40 p-4 text-right">
            <p className="text-sm text-zinc-500">Current Balance</p>
            <p className="text-2xl font-black text-cyan-300">{Number(profile.troll_coins || 0).toLocaleString()} TC</p>
          </div>
        </div>
        <div className={`${innerPanel} overflow-hidden`}>
          <div className="border-b border-white/10 p-5"><h4 className="font-black text-white">Recent {isEarnings ? 'Earnings' : 'Purchases'}</h4></div>
          {loadingRows ? <div className="p-8 text-center text-zinc-500">Loading...</div> : rows.length > 0 ? (
            <div className="divide-y divide-white/10">
              {rows.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-4 p-5">
                  <div><p className="font-bold text-white capitalize">{tx.metadata?.perk_name || String(tx.type || 'transaction').replace('_', ' ')}</p><p className="text-xs text-zinc-500">{formatDateTime(tx.created_at)}</p></div>
                  <span className={`font-black ${isEarnings ? 'text-emerald-300' : 'text-pink-300'}`}>{isEarnings ? '+' : ''}{Number(tx.amount || 0).toLocaleString()} TC</span>
                </div>
              ))}
            </div>
          ) : <div className="p-8 text-center text-zinc-500">No recent {isEarnings ? 'earnings' : 'purchases'} found.</div>}
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <div className={`${innerPanel} p-6`}>
        <SectionHeader icon={Bell} title="Notification Controls" subtitle="Control the way Troll City reaches your profile" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h4 className="font-black text-white">Announcements</h4>
            <p className="mt-1 text-sm text-zinc-400">Receive platform announcements and city alerts.</p>
            <button onClick={toggleAnnouncements} disabled={savingPreferences} className={`${announcementsEnabled ? primaryButton : secondaryButton} mt-4`}>{announcementsEnabled ? 'Enabled' : 'Disabled'}</button>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h4 className="font-black text-white">Banner Notifications</h4>
            <p className="mt-1 text-sm text-zinc-400">Show important visual notifications across the app.</p>
            <button onClick={toggleBannerNotifications} disabled={savingPreferences} className={`${bannerNotificationsEnabled ? primaryButton : secondaryButton} mt-4`}>{bannerNotificationsEnabled ? 'Enabled' : 'Disabled'}</button>
          </div>
        </div>
      </div>

      <div className={`${innerPanel} p-6`}>
        <SectionHeader icon={Coins} title="Profile Pricing" subtitle="Set costs for profile messaging and viewing" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-2 block text-sm font-bold text-zinc-300">Message Cost</span><input type="number" min={0} value={messageCost} onChange={(e) => setMessageCost(Number(e.target.value))} className={inputClass} /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-zinc-300">Profile View Cost</span><input type="number" min={0} value={viewCost} onChange={(e) => setViewCost(Number(e.target.value))} className={inputClass} /></label>
        </div>
        <button onClick={handleUpdateCosts} disabled={savingPreferences} className={`${primaryButton} mt-5`}>Save Profile Costs</button>
      </div>

      <div className={`${innerPanel} p-6`}>
        <SectionHeader icon={Settings} title="Account Actions" subtitle="Manage cache, session, and account safety" />
        <div className="flex flex-wrap gap-3">
          <button onClick={handleClearCacheReload} className={secondaryButton}><RefreshCw className="mr-2 inline h-4 w-4" /> Clear Cache & Reload</button>
          <button onClick={handleLogout} className={secondaryButton}><LogOut className="mr-2 inline h-4 w-4" /> Logout</button>
          <button onClick={handleDeleteAccount} className={dangerButton}><Trash2 className="mr-2 inline h-4 w-4" /> Delete Account</button>
        </div>
      </div>
    </div>
  );

  const renderAdminTitles = () => (
    <div className={`${innerPanel} p-6`}>
      <SectionHeader icon={FileText} title="Admin Titles" subtitle="Private authority and staff status connected to this account" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <h4 className="font-black text-white">Platform Role</h4>
          <p className="mt-1 text-sm text-zinc-400">The official Troll City staff role assigned to your account</p>
          <p className="mt-3 text-2xl font-black text-cyan-300">{profile.troll_role || profile.role || 'user'}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <h4 className="font-black text-white">Verification Status</h4>
          <p className="mt-1 text-sm text-zinc-400">Whether your account has been verified by Troll City administration</p>
          <p className="mt-3 text-2xl font-black text-emerald-300">{profile.is_verified ? 'Verified ✓' : 'Not Verified'}</p>
        </div>
      </div>
    </div>
  );

  const renderRecordedStreams = () => (
    <div className="space-y-6">
      <SectionHeader icon={Video} title="Broadcast Replays" subtitle="Your archived live broadcasts" />
      <ProfileReplays userId={profile.id} />
    </div>
  );

  const renderTabsContent = () => {
    switch (activeTab) {
      case 'social':
        return renderSocial();
      case 'recorded':
        return renderRecordedStreams();
      case 'watchlist':
        return <ProfileWatchlist userId={profile.id} />;
      case 'background':
        return <BackgroundCheckView userId={profile.id} />;
      case 'inventory':
        return renderInventory();
      case 'earnings':
        return renderLedger('earnings');
      case 'purchases':
        return renderLedger('purchases');
      case 'settings':
        return renderSettings();
      case 'admin_titles':
        return renderAdminTitles();
      default:
        return renderSocial();
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={shell}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(147,51,234,0.22),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(45,212,191,0.16),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.85))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:42px_42px]" />

      <main className="relative mx-auto max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
        <section className={`${panel} overflow-hidden`}>
          <div className="relative h-56 overflow-hidden md:h-72">
            {profile.banner_url ? (
              <img src={`${profile.banner_url}${profile.banner_url.includes('?') ? '&' : '?'}cb=${profile.updated_at || Date.now()}`} alt="Cover Photo" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.20),transparent_28%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-black/45 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 to-transparent" />
            <div className="absolute left-5 top-5 rounded-full border border-cyan-300/25 bg-slate-950/60 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100 shadow-[0_0_18px_rgba(45,212,191,0.18)] backdrop-blur-xl">Troll City Profile</div>
          </div>

          <div className="relative px-5 pb-6 md:px-8">
            <div className="-mt-20 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <button type="button" onClick={() => isProfileLive && liveStreamId && navigate(`/watch/${liveStreamId}`)} className={`relative h-44 w-44 shrink-0 rounded-[2rem] border-4 bg-black p-1 shadow-[0_0_50px_rgba(0,0,0,0.8)] ${isProfileLive ? 'border-red-400 cursor-pointer' : 'border-cyan-300/40'}`}>
                  <ProfileFrame frame={equippedFrame} avatarUrl={avatarUrl} size="xxl" username={profile.username} fillParent />
                  {isProfileLive && <span className="absolute -right-2 -top-2 z-10 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white shadow-[0_0_24px_rgba(239,68,68,0.8)] animate-pulse">LIVE</span>}
                </button>

                <div className="pb-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {profile.platform && <Pill className="border-cyan-300/30 text-cyan-100">{profile.platform === 'trollcity' ? '🏙️ Troll City' : profile.platform}</Pill>}
                    {profile.is_verified && <Pill className="border-blue-400/30 text-blue-200">✓ Verified</Pill>}
                    {(profile as any).is_minor && <Pill className="border-pink-400/30 text-pink-200">MINOR</Pill>}
                    <UserBadge profile={profile} />
                  </div>
                  <h1 className={`text-3xl font-black tracking-tight md:text-5xl ${hasRgbUsername ? 'rgb-username' : ''}`} style={usernameStyle}>
                    {profile.display_name || profile.username}
                    {(profile as any).gender === 'male' && <span className="ml-2 text-2xl text-blue-400">♂</span>}
                    {(profile as any).gender === 'female' && <span className="ml-2 text-2xl text-pink-400">♀</span>}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                    <span className={isGold || hasRgbUsername ? 'font-black text-cyan-300' : ''} style={isGold && profile?.username_style === 'gold' ? { color: '#FFD700', textShadow: '0 0 10px #FFD700' } : undefined}>@{profile.username}</span>
                    <span>Level {profile?.level || 1} • {levelName}</span>
                    {profile.license_plate && <Pill className="border-blue-400/30 text-blue-200">Plate: {profile.license_plate}</Pill>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pb-2">
                {isOwnProfile ? (
                  <>
                    <button onClick={() => navigate('/profile/setup')} className={primaryButton}><Settings className="mr-2 inline h-4 w-4" /> Edit Profile</button>
                    <button onClick={handleClearCacheReload} className={secondaryButton} title="Clear cache and reload"><RefreshCw className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={handleFollow} className={isFollowing ? secondaryButton : primaryButton}><UserPlus className="mr-2 inline h-4 w-4" /> {isFollowing ? 'Following' : 'Follow'}</button>
                    <button onClick={handleMessage} className={secondaryButton}><MessageCircle className="mr-2 inline h-4 w-4" /> Message</button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 md:max-w-xl">
              <StatCard label="Following" value={followingCount.toLocaleString()} onClick={() => navigate(`/following/${profile.id}`)} />
              <StatCard label="Followers" value={followersCount.toLocaleString()} onClick={() => navigate(`/following/${profile.id}`)} />
              <StatCard label="Posts" value={postsCount.toLocaleString()} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className={`${panel} p-3`}>
              <div className="hidden flex-wrap gap-2 md:flex">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button key={tab.key} onClick={() => handleTabSelect(tab.key)} className={`rounded-2xl px-4 py-3 text-sm font-black transition ${active ? 'bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 text-white shadow-[0_0_25px_rgba(45,212,191,0.22)]' : 'border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white hover:border-cyan-300/30'}`}>
                      <Icon className="mr-2 inline h-4 w-4" /> {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">{renderTabsContent()}</div>
            </div>

            {profile.bio && (
              <div className={`${innerPanel} p-5`}>
                <h3 className="mb-2 text-lg font-black text-white">About</h3>
                <p className="text-zinc-300 whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className={`${innerPanel} p-5`}>
              <SectionHeader icon={Calendar} title="Account Info" subtitle="When this account was created and last seen" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Member Since</p>
                  <p className="mt-1 font-black text-white">{formatDate(profile.created_at)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Last Updated</p>
                  <p className="mt-1 font-black text-white">{formatDate(profile.updated_at)}</p>
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <div className={`${innerPanel} p-5`}>
                <SectionHeader icon={Palette} title="Profile Frames" subtitle="Equip a Pride frame to earn challenges" />
                <div className="mt-3">
                  {prideLoading ? (
                    <div className="text-sm text-zinc-400">Loading themes...</div>
                  ) : prideThemes.length === 0 ? (
                    <div className="text-sm text-zinc-500">You don't own any Pride frames.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {prideThemes.map((t: any) => (
                        <div key={t.id} className="rounded-lg border border-white/6 p-2">
                          <div className="mb-2 h-20 w-full overflow-hidden rounded-md bg-black/20">
                            {t.preview_url ? <img src={t.preview_url} className="w-full h-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400">No preview</div>}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-white truncate">{t.name}</div>
                            <button
                              disabled={equippingTheme !== null}
                              onClick={async () => {
                                if (!currentUser) return;
                                try {
                                  setEquippingTheme(t.id);
                                  const { error: rpcErr } = await supabase.rpc('set_active_broadcast_theme', { p_user_id: currentUser.id, p_theme_id: t.id });
                                  if (rpcErr) throw rpcErr;
                                  toast.success('Profile frame equipped');
                                  // trigger badge evaluation
                                  try {
                                    const { data: session } = await supabase.auth.getSession();
                                    const token = session.session?.access_token;
                                    const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
                                    if (token) {
                                      await fetch(`${edgeFunctionsUrl}/evaluate-badges-for-event`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ event_type: 'pride_frame_equipped', user_id: currentUser.id, metadata: { theme_id: t.id } }),
                                      });
                                    }
                                  } catch (e) {
                                    console.warn('Badge evaluation failed:', e);
                                  }
                                  // refresh local profile state
                                  await refreshProfile();
                                } catch (err) {
                                  console.error('Equip theme failed:', err);
                                  toast.error('Failed to equip frame');
                                } finally {
                                  setEquippingTheme(null);
                                }
                              }}
                              className="rounded-lg bg-white/6 px-3 py-1 text-xs font-bold text-white"
                            >
                              {equippingTheme === t.id ? 'Equipping…' : t.is_active_for_user ? 'Active' : 'Equip'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <CreditScoreBadge userId={profile.id} creditScore={profile.credit_score || creditData?.score || null} />

            {currentUser && (
              <div className={`${innerPanel} p-5`}>
                <SectionHeader icon={MapPin} title="Your Location" subtitle="Vehicle and property assets" />
                {(() => {
                  const userInventory = inventory;
                  const myActiveVehicle = userInventory.vehicles.find((v: any) => String(profile.active_vehicle) === String(v.id));
                  if (!myActiveVehicle) {
                    return <p className="text-sm text-zinc-400">No active vehicle set.</p>;
                  }
                  const catalog = myActiveVehicle.vehicles_catalog;
                  return (
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center gap-3">
                        <Car className="h-10 w-10 text-cyan-300" />
                        <div>
                          <h4 className="font-black text-white">{catalog?.name || 'Active Vehicle'}</h4>
                          <p className="text-xs text-zinc-400">{catalog?.tier || 'Standard'} Class</p>
                        </div>
                      </div>
                      <Pill className={myActiveVehicle.insurance_expiry && new Date(myActiveVehicle.insurance_expiry) > new Date() ? 'border-emerald-500/30 text-emerald-300' : 'text-zinc-400'}>
                        {myActiveVehicle.insurance_expiry && new Date(myActiveVehicle.insurance_expiry) > new Date() ? 'Insured' : 'No Insurance'}
                      </Pill>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </section>

        {showInsuranceCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowInsuranceCard(null)}>
            <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-blue-500/30 bg-[#07101f] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-500 p-4">
                <div className="flex items-center gap-2"><Shield className="text-white" /><h2 className="text-lg font-black uppercase tracking-wider text-white">Troll City Insurance</h2></div>
                <button onClick={() => setShowInsuranceCard(null)} className="rounded-full bg-white/20 p-2"><X className="h-4 w-4 text-white" /></button>
              </div>
              
              <div className="p-6 space-y-5 bg-[#0f172a] relative overflow-hidden">
                 <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                 
                 <div className="flex justify-between items-start relative z-10">
                    <div>
                       <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Policy Holder</p>
                       <p className="text-xl font-bold text-white tracking-tight">{getProfileDisplayName(showInsuranceCard.user)}</p>
                       <p className="text-xs text-blue-400/80 font-mono mt-0.5">ID: {showInsuranceCard.user.id.slice(0, 8)}</p>
                   </div>
                   {showInsuranceCard.user.avatar_url ? (
                      <img src={showInsuranceCard.user.avatar_url} className="w-16 h-16 rounded-lg border-2 border-blue-500/30 object-cover shadow-lg bg-black" />
                   ) : (
                      <div className="w-16 h-16 rounded-lg border-2 border-blue-500/30 bg-blue-900/20 flex items-center justify-center">
                         <span className="text-2xl">👤</span>
                      </div>
                   )}
                </div>

                <div className="grid grid-cols-2 gap-4 relative z-10 bg-blue-900/10 p-3 rounded-xl border border-blue-500/10">
                    <div>
                       <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Vehicle</p>
                       <p className="text-sm font-bold text-white truncate">{showInsuranceCard.config?.name || 'Unknown Vehicle'}</p>
                       <p className="text-xs text-gray-400">{showInsuranceCard.config?.tier || 'Standard'} Class</p>
                    </div>
                    <div>
                       <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Status</p>
                       <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold uppercase shadow-sm">
                          <CheckCircle size={10} strokeWidth={3} /> Active
                       </div>
                    </div>
                </div>
                
                <div className="border-t border-blue-500/20 pt-4 relative z-10">
                    <div className="flex justify-between items-center">
                       <div>
                          <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Expires</p>
                          <p className="text-sm font-mono text-white font-medium">
                             {new Date(showInsuranceCard.vehicle.insurance_expiry).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-gray-500">
                             {new Date(showInsuranceCard.vehicle.insurance_expiry).toLocaleTimeString()}
                          </p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] uppercase text-blue-400 tracking-widest mb-1 font-semibold">Policy ID</p>
                          <p className="text-xs font-mono text-gray-500">
                             {showInsuranceCard.vehicle.id.slice(0, 12)}...
                          </p>
                       </div>
                    </div>
                </div>
             </div>
             
             {/* Footer */}
             <div className="bg-[#020617] p-3 text-center border-t border-blue-900/30">
                <p className="text-[10px] text-slate-500 font-medium">Authorized by Troll City Motor Vehicle Department</p>
                <button 
                  className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/20" 
                  onClick={() => setShowInsuranceCard(null)}
                >
                  Close Card
                </button>
             </div>
            </div>
          </div>
        )}

        {showColorPickerModal && currentUser?.id && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[2rem] border border-cyan-300/30 bg-[#090506] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 p-6">
                <h2 className="flex items-center gap-2 text-xl font-black text-white"><Sparkles className="h-5 w-5 text-cyan-300" /> Choose Glow Color</h2>
                <button onClick={() => setShowColorPickerModal(false)} className="text-zinc-400 transition hover:text-white"><X className="h-6 w-6" /></button>
              </div>
              <div className="p-6">
                <GlowingUsernameColorPicker userId={currentUser.id} onColorSelected={() => { setShowColorPickerModal(false); toast.success('Color saved!'); refreshProfile(); }} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Profile() {
  const inRouter = useInRouterContext();
  if (!inRouter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="text-sm text-zinc-400">Profile view is unavailable outside the app router.</div>
      </div>
    );
  }
  return <ProfileInner />;
}
