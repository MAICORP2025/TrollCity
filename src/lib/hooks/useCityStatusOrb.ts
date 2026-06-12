import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import {
  getTLeagueTier,
  calculateLeagueScore,
  getTLeagueProgress,
  getNextTLeagueTier,
  getSubTierFromScore,
  getSubTierProgress,
  getNextSubTier,
  getScoreForNextSubTier,
  getLeagueLevel,
  getNextLeagueLevel,
  getLeagueLevelProgress,
  getSubTierColor,
} from '../../config/T_LEAGUE_CONFIG';

export interface CityStatusOrbData {
  // User profile data
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  next_level_xp: number | null;
  hype_coins: number;
  license_plate: string | null;
  license_status: string | null;
  drivers_license_expiry: string | null;
  homeowners_insurance_expiry: string | null;
  house_id: string | null;
  vehicle_id: string | null;
  role: string | null;
  is_admin: boolean | null;
  is_troll_officer: boolean | null;

  // T League data
  league_tier: string;
  league_sub_tier: string;
  league_score: number;
  gift_coins_received: number;
  total_live_minutes: number;
  season_key: string;
  league_level: number;
  total_gifts_sent: number;

  // Computed
  tLeagueTier: ReturnType<typeof getTLeagueTier>;
  leagueProgress: number;
  nextTier: ReturnType<typeof getTLeagueTier> | null;
  coinsToNextLeague: number;
  subTierColor: string;
  activeMissions: Array<{ id: string; title: string; progress: number; goal: number; reward: number }>;
}

export interface CityStatusOrbOptions {
  userId: string;
  /** If provided, broadcaster context for role-based actions */
  broadcasterId?: string;
  /** If provided, whether the viewer is in a seat */
  isSeatHolder?: boolean;
  /** If provided, whether the current user is a broadcaster */
  isBroadcaster?: boolean;
  /** If provided, whether the current user is a BroadOfficer */
  isBroadOfficer?: boolean;
}

export function useCityStatusOrb(options: CityStatusOrbOptions) {
  const { user, profile } = useAuthStore();
  const [data, setData] = useState<CityStatusOrbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!options.userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          level,
          xp,
          next_level_xp,
          hype_coins,
          license_plate,
          license_status,
          drivers_license_expiry,
          homeowners_insurance_expiry,
          house_id,
          vehicle_id,
          role,
          is_admin,
          is_troll_officer
        `)
        .eq('id', options.userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Fetch broadcast league stats (current season)
      const seasonKey = new Date().toISOString().slice(0, 7); // YYYY-MM
      const { data: leagueData } = await supabase
        .from('broadcast_league_stats')
        .select('league_tier, sub_tier, league_score, gift_coins_received, total_live_minutes, season_key, league_level, total_gifts_sent')
        .eq('broadcaster_id', options.userId)
        .eq('season_key', seasonKey)
        .maybeSingle();

      const leagueScore = leagueData
        ? calculateLeagueScore(
            Number(leagueData.gift_coins_received) || 0,
            Number(leagueData.total_live_minutes) || 0
          )
        : 0;

      const subInfo = getSubTierFromScore(leagueScore);
      const tLeagueTier = subInfo.tier;
      const leagueLevelInfo = getLeagueLevel(Number(leagueData?.total_gifts_sent) || 0);

      const orbData: CityStatusOrbData = {
        id: profileData?.id || options.userId,
        username: profileData?.username || 'Unknown',
        display_name: profileData?.display_name || null,
        avatar_url: profileData?.avatar_url || null,
        level: profileData?.level || 1,
        xp: profileData?.xp || 0,
        next_level_xp: profileData?.next_level_xp || null,
        hype_coins: profileData?.hype_coins || 0,
        license_plate: profileData?.license_plate || null,
        license_status: profileData?.license_status || null,
        drivers_license_expiry: profileData?.drivers_license_expiry || null,
        homeowners_insurance_expiry: profileData?.homeowners_insurance_expiry || null,
        house_id: profileData?.house_id || null,
        vehicle_id: profileData?.vehicle_id || null,
        role: profileData?.role || null,
        is_admin: profileData?.is_admin || null,
        is_troll_officer: profileData?.is_troll_officer || null,

        league_tier: leagueData?.league_tier || tLeagueTier.tier,
        league_sub_tier: leagueData?.sub_tier || subInfo.sub,
        league_score: leagueScore,
        gift_coins_received: Number(leagueData?.gift_coins_received) || 0,
        total_live_minutes: Number(leagueData?.total_live_minutes) || 0,
        season_key: leagueData?.season_key || seasonKey,
        league_level: Number(leagueData?.league_level) || leagueLevelInfo.level,
        total_gifts_sent: Number(leagueData?.total_gifts_sent) || 0,

        tLeagueTier,
        leagueProgress: getSubTierProgress(leagueScore),
        subTierColor: getSubTierColor(tLeagueTier.tier, subInfo.sub),
      };

      // Calculate progress within sub-tier
      const nextSub = getNextSubTier(tLeagueTier, subInfo.sub);
      orbData.nextTier = nextSub ? {
        tier: nextSub.tier.tier,
        minScore: nextSub.tier.minScore,
        label: nextSub.tier.label,
        color: nextSub.tier.color,
        badgeColor: nextSub.tier.badgeColor,
        textColor: nextSub.tier.textColor,
        icon: nextSub.tier.icon,
        subTiers: nextSub.tier.subTiers,
      } : null;
      orbData.coinsToNextLeague = orbData.nextTier
        ? Math.max(0, orbData.nextTier.minScore - leagueScore)
        : 0;

      // Fetch active missions/goals (graceful if table doesn't exist yet)
      try {
        const { data: missionsData } = await supabase
          .from('broadcast_missions')
          .select('id, title, description, target_type, target_value, current_progress, reward_coins, status')
          .eq('broadcaster_id', options.userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5);
        orbData.activeMissions = (missionsData || []).map((m: any) => ({
          id: m.id,
          title: m.title || m.description || 'Mission',
          progress: Number(m.current_progress) || 0,
          goal: Number(m.target_value) || 1,
          reward: Number(m.reward_coins) || 0,
        }));
      } catch {
        orbData.activeMissions = [];
      }

      if (isMountedRef.current) {
        setData(orbData);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[useCityStatusOrb] Error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load user status');
        setLoading(false);
      }
    }
  }, [options.userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Determine role-based permissions
  const currentUserId = user?.id;
  const isSelf = currentUserId === options.userId;
  const isAdmin = profile?.is_admin === true || profile?.role === 'admin';
  const isCEO = profile?.role === 'ceo' || profile?.is_ceo === true;
  const isOfficer = profile?.is_troll_officer === true;
  const isBroadcasterContext = options.isBroadcaster === true;
  const isBroadOfficer = options.isBroadOfficer === true;
  const isSeatHolder = options.isSeatHolder === true;

  // Can view license/plate/insurance details
  const canCheckLicense = isBroadcasterContext || isBroadOfficer || isAdmin || isCEO || isOfficer;

  // Can raid: anyone in broadcast (viewer, seat holder, broadcaster) if not self and target has house
  const canRaid =
    !isSelf &&
    data?.house_id != null &&
    (isSeatHolder || isBroadcasterContext || options.broadcasterId != null);

  // Can repair: only self/owner
  const canRepair = isSelf;

  // Can use enforcement: BroadOfficer, Admin, CEO, officer roles
  const canEnforce = isBroadOfficer || isAdmin || isCEO || isOfficer;

  // Can remove from seat: broadcaster or BroadOfficer
  const canRemoveFromSeat = isBroadcasterContext || isBroadOfficer || isAdmin;

  // Can access all actions: admin/CEO/career roles
  const canAccessAll = isAdmin || isCEO || isOfficer;

  return {
    data,
    loading,
    error,
    refetch: fetchStatus,
    permissions: {
      isSelf,
      canCheckLicense,
      canRaid,
      canRepair,
      canEnforce,
      canRemoveFromSeat,
      canAccessAll,
    },
  };
}
