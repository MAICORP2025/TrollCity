import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BattleSounds } from '@/lib/battleSounds';

/**
 * Consolidated battle realtime hook.
 *
 * BEFORE: Each viewer created 9+ separate supabase channels for battle data:
 *   - battle:${battleId} (postgres_changes on battles)
 *   - battle_participants:${battleId} (postgres_changes on battle_participants)
 *   - battle_arena:${battleId} (broadcast arena_ready)
 *   - battle_stream_${challengerId} (postgres_changes + broadcast)
 *   - battle_stream_${opponentId} (postgres_changes + broadcast)
 *   - battle-sync-gifts:${challengerId} (broadcast gift_sent)
 *   - battle-sync-gifts:${opponentId} (broadcast gift_sent)
 *   - 5v5-battle:${battleId} (broadcast *)
 *   - battle_timer:${battleId} (broadcast timer_sync)
 *
 * AFTER: One consolidated channel per battle that routes ALL battle events:
 *   - battle-all:${battleId} — single channel with postgres_changes on battles + battle_sessions
 *                                 + broadcast for arena, gifts, timer, scores, abilities
 *
 * Channel count: 9+ → 1 per viewer
 */

export interface BattleRealtimeState {
  battle: any | null;
  participants: any[];
  arenaReady: boolean;
  challengerStream: any | null;
  opponentStream: any | null;
  lastGift: { username: string; amount: number; team: 'A' | 'B' } | null;
  abilityEffects: Array<{ id: string; type: string; team?: 'A' | 'B'; username: string; timestamp: number }>;
  timerSeconds: number;
  phase: 'idle' | 'pre_battle' | 'active' | 'ended';
  winner: 'A' | 'B' | 'draw' | null;
}

const INITIAL: BattleRealtimeState = {
  battle: null,
  participants: [],
  arenaReady: false,
  challengerStream: null,
  opponentStream: null,
  lastGift: null,
  abilityEffects: [],
  timerSeconds: 0,
  phase: 'idle',
  winner: null,
};

export function useBattleRealtime(battleId: string | null | undefined) {
  const [state, setState] = useState<BattleRealtimeState>(INITIAL);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const scorePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!battleId) {
      setState(INITIAL);
      return;
    }

    // Clean up any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `battle-all:${battleId}`;
    const channel = supabase.channel(channelName);

    // 1. Postgres changes on battles table (replaces battle:${battleId} channel)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'battles',
      filter: `id=eq.${battleId}`,
    }, (payload) => {
      if (!mountedRef.current) return;
      const updated = payload.new;
      setState(prev => {
        const newPhase = updated.status === 'ended' ? 'ended'
          : updated.status === 'active' ? 'active'
          : prev.phase;
        const newTimer = updated.status === 'active' && updated.started_at
          ? Math.max(0, 180 - Math.floor((Date.now() - new Date(updated.started_at).getTime()) / 1000))
          : prev.timerSeconds;
        return {
          ...prev,
          battle: { ...prev.battle, ...updated },
          phase: newPhase,
          timerSeconds: newTimer,
          winner: updated.status === 'ended'
            ? (updated.score_challenger > updated.score_opponent ? 'A' :
               updated.score_opponent > updated.score_challenger ? 'B' : 'draw')
            : prev.winner,
        };
      });
    });

    // 2. Postgres changes on battle_participants (replaces battle_participants:${battleId} channel)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'battle_participants',
      filter: `battle_id=eq.${battleId}`,
    }, async () => {
      if (!mountedRef.current) return;
      try {
        const { data } = await supabase
          .from('battle_participants')
          .select('user_id, role')
          .eq('battle_id', battleId);
        if (mountedRef.current) {
          setState(prev => ({ ...prev, participants: data || [] }));
        }
      } catch {}
    });

    // 3. Broadcast: arena_ready (replaces battle_arena:${battleId} channel)
    channel.on('broadcast', { event: 'arena_ready' }, (payload) => {
      if (!mountedRef.current) return;
      const readyAtMs = Number(payload?.payload?.ready_at_ms || 0);
      if (!readyAtMs) return;
      setState(prev => {
        if (prev.arenaReady) return prev;
        return { ...prev, arenaReady: true };
      });
    });

    // 4. Broadcast: gift_sent (replaces battle-sync-gifts:${streamId} channels)
    // Score updates come via the dedicated score_update broadcast, so we only
    // need to update the lastGift info here for the gift animation.
    channel.on('broadcast', { event: 'gift_sent' }, (payload) => {
      if (!mountedRef.current) return;
      const data = payload?.payload;
      if (!data) return;
      BattleSounds.scoreUpdate();
      setState(prev => ({
        ...prev,
        lastGift: {
          username: data.sender_name || data.sender_username || 'Unknown',
          amount: data.amount || 0,
          team: data.team || data.stream_id || 'A',
        },
      }));
    });

    // 5. Broadcast: timer_sync (replaces battle_timer:${battleId} channel)
    channel.on('broadcast', { event: 'timer_sync' }, (payload) => {
      if (!mountedRef.current) return;
      const data = payload?.payload;
      if (!data || data.timeLeft === undefined) return;
      // Tick sound for last 10 seconds
      if (data.timeLeft <= 10 && data.timeLeft > 0) {
        BattleSounds.timerTick();
      }
      // Sudden death transition sound
      if (data.timeLeft === 15) {
        BattleSounds.suddenDeath();
      }
      setState(prev => ({
        ...prev,
        timerSeconds: data.timeLeft,
        ...(data.battleEnded ? { phase: 'ended' as const } : {}),
      }));
    });

    // 6. Broadcast: score_update (replaces redundant score polling)
    channel.on('broadcast', { event: 'score_update' }, (payload) => {
      if (!mountedRef.current) return;
      const data = payload?.payload;
      if (!data) return;
      BattleSounds.scoreUpdate();
      setState(prev => ({
        ...prev,
        battle: prev.battle ? {
          ...prev.battle,
          score_challenger: data.score_challenger ?? prev.battle.score_challenger,
          score_opponent: data.score_opponent ?? prev.battle.score_opponent,
        } : prev.battle,
        lastGift: data.lastGift || prev.lastGift,
      }));
    });

    // 7. Broadcast: ability_used (replaces 5v5-battle ability events)
    channel.on('broadcast', { event: 'ability_used' }, (payload) => {
      if (!mountedRef.current) return;
      const data = payload?.payload;
      if (!data) return;
      if (data.ability === 'team_freeze' && data.targetTeam) {
        const freezeKey = data.targetTeam === 'A' ? 'A' : 'B';
        setState(prev => ({
          ...prev,
          frozenTeams: { ...(prev as any).frozenTeams, [freezeKey]: true },
        }));
        setTimeout(() => {
          if (mountedRef.current) {
            setState(prev => ({
              ...prev,
              frozenTeams: { ...(prev as any).frozenTeams, [freezeKey]: false },
            }));
          }
        }, 5000);
      }
    });

    // 8. Broadcast: battle_ended (replaces 5v5-battle battle_ended event)
    channel.on('broadcast', { event: 'battle_ended' }, (payload) => {
      if (!mountedRef.current) return;
      const data = payload?.payload;
      BattleSounds.battleEnd();
      setState(prev => ({
        ...prev,
        phase: 'ended',
        winner: data?.winner || null,
        timerSeconds: 0,
      }));
    });

    // 9. Broadcast: battle_start (replaces 5v5-battle battle_start event)
    channel.on('broadcast', { event: 'battle_start' }, (payload) => {
      if (!mountedRef.current) return;
      const data = payload?.payload;
      setState(prev => ({
        ...prev,
        phase: 'active',
        timerSeconds: data?.duration || 180,
      }));
    });

    channel.subscribe();
    channelRef.current = channel;

    // Fetch initial battle data
    const fetchInitial = async () => {
      try {
        const [{ data: battle }, { data: participants }] = await Promise.all([
          supabase.from('battles').select('*').eq('id', battleId).maybeSingle(),
          supabase.from('battle_participants').select('user_id, role').eq('battle_id', battleId),
        ]);
        if (!mountedRef.current) return;
        setState(prev => ({
          ...prev,
          battle,
          participants: participants || [],
          phase: battle?.status === 'active' ? 'active'
            : battle?.status === 'ended' ? 'ended'
            : prev.phase,
          timerSeconds: battle?.status === 'active' && battle?.started_at
            ? Math.max(0, 180 - Math.floor((Date.now() - new Date(battle.started_at).getTime()) / 1000))
            : prev.timerSeconds,
        }));
      } catch {}
    };
    fetchInitial();

    // ── Fast score sync ──────────────────────────────────────────────────
    // During active battles, poll the score every 10s as a safety net.
    // The postgres_changes handler above handles most updates, but rapid
    // RPC-driven score changes (e.g. from gifts) can occasionally be missed
    // by realtime. This ensures the score overlay never lags more than 10s.
    if (scorePollRef.current) {
      clearInterval(scorePollRef.current);
      scorePollRef.current = null;
    }
    scorePollRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { data } = await supabase
          .from('battles')
          .select('score_challenger, score_opponent, status')
          .eq('id', battleId)
          .maybeSingle();
        if (data && mountedRef.current) {
          setState(prev => {
            if (!prev.battle) return prev;
            if (
              prev.battle.score_challenger !== data.score_challenger ||
              prev.battle.score_opponent !== data.score_opponent ||
              prev.battle.status !== data.status
            ) {
              return {
                ...prev,
                battle: { ...prev.battle, ...data },
                phase: data.status === 'ended' ? 'ended' as const
                  : data.status === 'active' ? 'active' as const
                  : prev.phase,
              };
            }
            return prev;
          });
        }
      } catch {}
    }, 5000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (scorePollRef.current) {
        clearInterval(scorePollRef.current);
        scorePollRef.current = null;
      }
    };
  }, [battleId]);

  // Arena ready publish helper (for hosts)
  const publishArenaReady = useCallback(async () => {
    if (!battleId) return;
    const nowMs = Date.now();
    // Use a short-lived publish channel — no need to maintain a separate subscription
    const pubChannel = supabase.channel(`battle-all:${battleId}`);
    await pubChannel.subscribe();
    await pubChannel.send({
      type: 'broadcast',
      event: 'arena_ready',
      payload: { ready_at_ms: nowMs },
    });
    setTimeout(() => supabase.removeChannel(pubChannel), 500);
  }, [battleId]);

  return { state, publishArenaReady };
}
