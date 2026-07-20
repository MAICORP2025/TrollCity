// Universe Battles API — thin wrappers over the secure universe_* RPCs.
// All competitive logic lives server-side (migrations 20260718*). The client
// never computes winners, picks opponents, chooses Troll Bag results, or sets
// ability durations.
import { supabase } from '../supabase'

export type UniverseRpcResult = { success: boolean; [k: string]: any }

async function rpc(name: string, params: Record<string, any>): Promise<UniverseRpcResult> {
  const { data, error } = await supabase.rpc(name as any, params as any)
  if (error) return { success: false, error: error.message || String(error) }
  return (data as UniverseRpcResult) ?? { success: true }
}

// ---- Registration & seats -------------------------------------------------
export const universeRegister = (eventId: string, attendance: boolean, rules: boolean) =>
  rpc('universe_register', { p_event_id: eventId, p_attendance_confirmed: attendance, p_rules_accepted: rules })

export const universeWithdraw = (eventId: string) =>
  rpc('universe_withdraw_registration', { p_event_id: eventId })

export const universeInviteSeat = (registrationId: string, seat: number, invitedUserId: string) =>
  rpc('universe_invite_seat', { p_registration_id: registrationId, p_seat_number: seat, p_invited_user_id: invitedUserId })

export const universeRespondSeat = (seatId: string, accept: boolean) =>
  rpc('universe_respond_seat', { p_seat_id: seatId, p_accept: accept })

export const universeRemoveSeat = (seatId: string) =>
  rpc('universe_remove_seat', { p_seat_id: seatId })

export const universeCheckIn = (registrationId: string, seatId?: string) =>
  rpc('universe_check_in', { p_registration_id: registrationId, p_seat_id: seatId ?? null })

export const universeRunMatchmaking = (eventId: string) =>
  rpc('universe_run_matchmaking', { p_event_id: eventId })

// ---- Match visibility (opponent hidden until reveal, enforced by RLS) ------
export const getMyUniverseMatches = (eventId: string) =>
  supabase.rpc('get_my_universe_matches', { p_event_id: eventId } as any)

export const getUniverseEventSummary = (eventId: string) =>
  supabase.rpc('universe_event_public_summary', { p_event_id: eventId } as any)

// ---- Rounds / scoring / Troll Bag / abilities -----------------------------
export const universeStartRound = (matchId: string) =>
  rpc('universe_start_round', { p_match_id: matchId })

export const universeApplyGift = (
  roundId: string, teamId: string, recipientId: string, captainId: string,
  senderId: string | null, giftId: string | null, amount: number,
) => rpc('universe_apply_gift', {
  p_round_id: roundId, p_team_id: teamId, p_gift_recipient_user_id: recipientId,
  p_team_captain_user_id: captainId, p_sender_id: senderId, p_gift_id: giftId, p_amount: amount,
})

export const universeClaimTrollBag = (roundId: string) =>
  rpc('universe_claim_troll_bag', { p_round_id: roundId })

export const universeActivateAbility = (abilityId: string, targetTeamId: string) =>
  rpc('universe_activate_ability', { p_ability_id: abilityId, p_target_team_id: targetTeamId })

export const universeFinalizeRound = (roundId: string) =>
  rpc('universe_finalize_round', { p_round_id: roundId })

export const universeAdminAction = (
  eventId: string, action: string, targetUserId?: string, details?: any,
) => rpc('universe_admin_action', {
  p_event_id: eventId, p_action: action,
  p_target_user_id: targetUserId ?? null, p_details: details ?? {},
})

// ---- Direct table reads (RLS-gated) ----------------------------------------
export const fetchUniverseEvents = (status?: string[]) =>
  supabase.from('universe_events').select('*')
    .in('status', status ?? ['registration_open', 'registration_closed', 'active', 'room_open', 'check_in'])
    .order('scheduled_start', { ascending: true })

export const fetchMyRegistrations = () =>
  supabase.from('universe_registrations').select('*, event:universe_events(*)')
    .order('created_at', { ascending: false })

export const fetchMySeats = () =>
  supabase.from('universe_team_seats').select('*, registration:universe_registrations(*)')
    .order('created_at', { ascending: false })

export const fetchActiveRounds = () =>
  supabase.from('universe_rounds').select('*, event:universe_events(*), teams:universe_round_teams(*)')
    .in('status', ['active', 'finalizing'])

export const fetchCalendarEntries = (userId: string) =>
  supabase.from('universe_calendar_entries').select('*')
    .eq('user_id', userId).order('scheduled_start', { ascending: true })

export const fetchEventResults = () =>
  supabase.from('universe_event_results').select('*, champion:user_profiles!champion_user_id(username, avatar_url)')
    .order('created_at', { ascending: false }).limit(20)

// ---- Universe Mode: Showdown sign-up system ---------------------------------
export const universeShowdownRegister = () =>
  rpc('universe_showdown_register', {})

export const universeShowdownWithdraw = () =>
  rpc('universe_showdown_withdraw', {})

export const universeShowdownInvite = (invitedUserId: string) =>
  rpc('universe_showdown_invite', { p_invited_user_id: invitedUserId })

export const universeShowdownRespondInvite = (inviteId: string, accept: boolean) =>
  rpc('universe_showdown_respond_invite', { p_invite_id: inviteId, p_accept: accept })

export const universeShowdownRemoveInvite = (inviteId: string) =>
  rpc('universe_showdown_remove_invite', { p_invite_id: inviteId })

// Public blind roster (battle names only, never real usernames).
export const fetchShowdownPublic = () =>
  supabase.from('universe_showdown_public').select('*').order('created_at', { ascending: true })

// Left-side live queue view.
export const fetchShowdownQueue = () =>
  supabase.from('universe_showdown_queue').select('*').order('queue_position', { ascending: true })

// My own signup + invites for the current user.
export const fetchMyShowdown = (userId: string) =>
  supabase
    .from('universe_showdown_signups')
    .select('*, battle:universe_showdown_battles(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

export const fetchMyShowdownInvites = (userId: string) =>
  supabase
    .from('universe_showdown_invites')
    .select('*, battle:universe_showdown_battles(*), inviter:user_profiles!inviter_user_id(username, avatar_url)')
    .eq('invited_user_id', userId)
    .order('created_at', { ascending: false })

export const fetchMyShowdownSentInvites = (userId: string) =>
  supabase
    .from('universe_showdown_invites')
    .select('*, invited:user_profiles!invited_user_id(username, avatar_url)')
    .eq('inviter_user_id', userId)
    .order('created_at', { ascending: false })

// Configured battle dates (for the calendar strip).
export const fetchShowdownDates = () =>
  supabase
    .from('universe_showdown_dates')
    .select('*')
    .eq('enabled', true)
    .order('scheduled_start', { ascending: true })
