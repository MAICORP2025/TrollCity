// =============================================
// TROLL MATCH (TM) SYSTEM TYPES + MATCHMAKING UTILS
// =============================================

// Core interest list. Keep this list clean because it powers profile matching,
// dating compatibility, friend discovery, and battle matchmaking.
export const TM_INTERESTS = [
  'Music (Rap)',
  'Music (R&B)',
  'Music (Pop)',
  'Music (Rock)',
  'Music (Country)',
  'Music (Electronic)',
  'Music (Other)',
  'Gaming',
  'Singing',
  'Movies',
  'Comedy',
  'Just Chatting',
  'Sports',
  'Content Creation',
  'Art & Design',
  'Cooking',
  'Travel',
  'Reading',
  'Fitness',
  'Technology',
  'Fashion',
  'Photography',
  'Dancing',
  'Nature',
  'Science',
  'History',
  'Politics',
  'Spirituality',
  'Pets',
] as const;

export type TMInterest = (typeof TM_INTERESTS)[number];

export const TM_GENDERS = [
  'Male',
  'Female',
  'Non-binary',
  'Trans Male',
  'Trans Female',
  'Prefer not to say',
  'Custom',
] as const;

export type TMGender = (typeof TM_GENDERS)[number];

export const TM_PREFERENCES = [
  'Male',
  'Female',
  'Non-binary',
  'Trans Male',
  'Trans Female',
  'Everyone',
] as const;

export type TMPreference = (typeof TM_PREFERENCES)[number];

export const TM_BATTLE_MODES = ['1v1', '2v2', '3v3', '4v4', 'universe'] as const;

export type TMBattleMode = (typeof TM_BATTLE_MODES)[number];

export const TM_BATTLE_MODE_LABELS: Record<TMBattleMode, string> = {
  '1v1': '1v1 Battle',
  '2v2': '2v2 Battle',
  '3v3': '3v3 Battle',
  '4v4': '4v4 Battle',
  universe: 'Universe Battle',
};

export const TM_MATCH_TIERS = [
  { min: 80, label: 'Elite Match', tone: 'emerald' },
  { min: 60, label: 'Strong Match', tone: 'purple' },
  { min: 40, label: 'Possible Match', tone: 'yellow' },
  { min: 0, label: 'Low Match', tone: 'slate' },
] as const;

export type TMMatchTier = (typeof TM_MATCH_TIERS)[number];

export interface TMProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  interests: TMInterest[];
  dating_enabled: boolean;
  gender: TMGender | null;
  preference: TMPreference[];
  message_price: number;
  is_online: boolean;
  last_active: string | null;
}

export interface TMMatch {
  user_id: string;
  username: string;
  avatar_url: string | null;
  interests: TMInterest[];
  shared_interests: TMInterest[];
  match_score: number;
  match_tier?: TMMatchTier;
  is_online: boolean;
  last_active: string | null;
  message_price?: number;
  is_live?: boolean;
  stream_id?: string | null;
  current_viewers?: number;
}

export interface TMProfileView {
  viewer_id: string;
  username: string;
  avatar_url: string | null;
  viewed_at: string;
  is_online: boolean;
}

export interface TMMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  price_paid: number;
  source: 'troll_match';
  created_at: string;
}

export interface TMFamilyInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  family_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  inviter_username?: string;
  family_name?: string;
}

export interface TMOnboardingState {
  interests: TMInterest[];
  datingEnabled: boolean;
  gender: TMGender | null;
  preference: TMPreference[];
}

export type TMTab = 'all-users' | 'friends' | 'dating' | 'viewed-me' | 'battle-match';

export interface TMMessagePricing {
  userId: string;
  price: number;
  username: string;
}

export interface TMUtromailComposerParams {
  recipientId: string;
  source: 'troll_match';
  initialMessage?: string;
}

export interface TMUseMatchesReturn {
  matches: TMMatch[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface TMUseViewedMeReturn {
  viewers: TMProfileView[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface TMFamilyInviteNotification {
  id: string;
  inviterUsername: string;
  familyId: string;
  familyName: string;
  createdAt: string;
}

export interface TMAllUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  interests: TMInterest[];
  is_online: boolean;
  last_active: string | null;
  created_at: string;
  is_live: boolean;
  stream_id: string | null;
  current_viewers: number;
  message_price?: number;
  dating_enabled?: boolean;
  gender?: TMGender | null;
  preference?: TMPreference[];
}

export interface TMBattleCandidate extends TMAllUser {
  shared_interests: TMInterest[];
  match_score: number;
  match_tier: TMMatchTier;
}

export interface TMBattleInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  match_score: number;
  shared_interests: TMInterest[];
  battle_mode: TMBattleMode;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface TMBattleQueueEntry {
  id: string;
  user_id: string;
  battle_mode: TMBattleMode;
  interests: TMInterest[];
  status: 'queued' | 'matched' | 'cancelled' | 'expired';
  created_at: string;
  matched_with_user_id: string | null;
}

export interface TMBattleMatchResult {
  candidate: TMBattleCandidate | null;
  candidatesChecked: number;
  mode: TMBattleMode;
  reason?: string;
}

export interface TMBattleSearchOptions {
  mode: TMBattleMode;
  requireOnline?: boolean;
  requireLive?: boolean;
  excludeUserIds?: string[];
}

export interface TMMatchScoreResult {
  match_score: number;
  shared_interests: TMInterest[];
  match_tier: TMMatchTier;
}

function normalizeInterestList(interests: readonly string[] | null | undefined): TMInterest[] {
  if (!Array.isArray(interests)) return [];

  const validInterests = new Set<string>(TM_INTERESTS);
  const unique = new Set<TMInterest>();

  interests.forEach((interest) => {
    if (validInterests.has(interest)) {
      unique.add(interest as TMInterest);
    }
  });

  return Array.from(unique);
}

export function getTMMatchTier(score: number): TMMatchTier {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  return TM_MATCH_TIERS.find((tier) => safeScore >= tier.min) || TM_MATCH_TIERS[TM_MATCH_TIERS.length - 1];
}

export function calculateTMMatchScore(
  currentUserInterests: readonly string[] | null | undefined,
  otherUserInterests: readonly string[] | null | undefined,
): TMMatchScoreResult {
  const current = normalizeInterestList(currentUserInterests);
  const other = normalizeInterestList(otherUserInterests);

  if (current.length === 0 || other.length === 0) {
    return {
      match_score: 0,
      shared_interests: [],
      match_tier: getTMMatchTier(0),
    };
  }

  const currentSet = new Set(current);
  const otherSet = new Set(other);
  const shared = current.filter((interest) => otherSet.has(interest));
  const denominator = Math.max(currentSet.size, otherSet.size, 1);
  const score = Math.round((shared.length / denominator) * 100);

  return {
    match_score: Math.max(0, Math.min(100, score)),
    shared_interests: shared,
    match_tier: getTMMatchTier(score),
  };
}

export function enrichTMMatch(currentUserInterests: TMInterest[], user: TMAllUser): TMBattleCandidate {
  const score = calculateTMMatchScore(currentUserInterests, user.interests);

  return {
    ...user,
    shared_interests: score.shared_interests,
    match_score: score.match_score,
    match_tier: score.match_tier,
  };
}

export function sortTMBattleCandidates(candidates: TMBattleCandidate[]): TMBattleCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    if (Number(b.is_online) !== Number(a.is_online)) return Number(b.is_online) - Number(a.is_online);
    if (Number(b.is_live) !== Number(a.is_live)) return Number(b.is_live) - Number(a.is_live);

    const aTime = a.last_active ? new Date(a.last_active).getTime() : 0;
    const bTime = b.last_active ? new Date(b.last_active).getTime() : 0;
    return bTime - aTime;
  });
}

export function findClosestTMBattleMatch(
  currentUserId: string,
  currentUserInterests: TMInterest[],
  users: TMAllUser[],
  options: TMBattleSearchOptions,
): TMBattleMatchResult {
  const excluded = new Set([currentUserId, ...(options.excludeUserIds || [])]);

  const eligibleUsers = users.filter((user) => {
    if (!user.user_id || excluded.has(user.user_id)) return false;
    if (options.requireOnline && !user.is_online) return false;
    if (options.requireLive && !user.is_live) return false;
    return true;
  });

  const candidates = sortTMBattleCandidates(
    eligibleUsers.map((user) => enrichTMMatch(currentUserInterests, user)),
  );

  return {
    candidate: candidates[0] || null,
    candidatesChecked: candidates.length,
    mode: options.mode,
    reason: candidates.length === 0 ? 'No eligible battle matches found.' : undefined,
  };
}

export function isDatingCompatible(currentUser: TMProfile, otherUser: TMProfile): boolean {
  if (!currentUser.dating_enabled || !otherUser.dating_enabled) return false;
  if (!currentUser.gender || !otherUser.gender) return false;

  const currentPreferences = currentUser.preference || [];
  const otherPreferences = otherUser.preference || [];

  const currentLikesOther = currentPreferences.includes('Everyone') || currentPreferences.includes(otherUser.gender as TMPreference);
  const otherLikesCurrent = otherPreferences.includes('Everyone') || otherPreferences.includes(currentUser.gender as TMPreference);

  return currentLikesOther && otherLikesCurrent;
}

export function getTMStatusLabel(user: Pick<TMAllUser, 'is_online' | 'is_live'>): string {
  if (user.is_live) return 'Live Now';
  if (user.is_online) return 'Online';
  return 'Offline';
}

export function getTMStatusTone(user: Pick<TMAllUser, 'is_online' | 'is_live'>): 'red' | 'green' | 'slate' {
  if (user.is_live) return 'red';
  if (user.is_online) return 'green';
  return 'slate';
}

export const TM_SQL_SETUP = `
create table if not exists public.tm_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interests text[] not null default '{}',
  dating_enabled boolean not null default false,
  gender text null,
  preference text[] not null default '{}',
  message_price integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique(viewer_id, viewed_user_id)
);

create table if not exists public.tm_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  price_paid integer not null default 0,
  source text not null default 'troll_match',
  created_at timestamptz not null default now()
);

create table if not exists public.tm_battle_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  match_score integer not null default 0,
  shared_interests text[] not null default '{}',
  battle_mode text not null default '1v1',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inviter_id, invitee_id, battle_mode, status)
);

create table if not exists public.tm_battle_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  battle_mode text not null default '1v1',
  interests text[] not null default '{}',
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  matched_with_user_id uuid null references auth.users(id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tm_battle_invites_status_check') then
    alter table public.tm_battle_invites
    add constraint tm_battle_invites_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tm_battle_invites_mode_check') then
    alter table public.tm_battle_invites
    add constraint tm_battle_invites_mode_check
    check (battle_mode in ('1v1', '2v2', '3v3', '4v4', 'universe'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tm_battle_queue_status_check') then
    alter table public.tm_battle_queue
    add constraint tm_battle_queue_status_check
    check (status in ('queued', 'matched', 'cancelled', 'expired'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tm_battle_queue_mode_check') then
    alter table public.tm_battle_queue
    add constraint tm_battle_queue_mode_check
    check (battle_mode in ('1v1', '2v2', '3v3', '4v4', 'universe'));
  end if;
end $$;

notify pgrst, 'reload schema';
`;
