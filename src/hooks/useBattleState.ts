import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type BattleStatus =
  | 'idle'
  | 'waiting_for_opponent'
  | 'pending_locked'
  | 'pending'
  | 'countdown'
  | 'active'
  | 'ended'
  | 'cancelled';

export interface BattleState {
  active: boolean;
  battleId: string | null;

  // New/server-authoritative team fields
  teamACaptain: string | null;
  teamBCaptain: string | null;
  teamAMembers: string[];
  teamBMembers: string[];
  teamAScore: number;
  teamBScore: number;

  // Legacy/current UI fields still used in this file and battle UI
  hostId: string | null;
  challengerId: string | null;
  broadcasterScore: number;
  challengerScore: number;
  hostReady: boolean;
  opponentReady: boolean;

  startedAt: Date | null;
  endsAt: Date | null;
  suddenDeath: boolean;
  status: BattleStatus;
  scheduledStartAt: Date | null;
}

export interface BattleSupporter {
  userId: string;
  team: 'broadcaster' | 'challenger';
}

export interface UseBattleStateProps {
  streamId: string;
  localUserId: string;
  isHost: boolean;
  hostId?: string;
}

const ACTIVE_BATTLE_STATUSES: BattleStatus[] = [
  'waiting_for_opponent',
  'pending_locked',
  'pending',
  'countdown',
  'active',
];

function isValidBattleStatus(status: unknown): status is BattleStatus {
  return (
    status === 'idle' ||
    status === 'waiting_for_opponent' ||
    status === 'pending_locked' ||
    status === 'pending' ||
    status === 'countdown' ||
    status === 'active' ||
    status === 'ended' ||
    status === 'cancelled'
  );
}

function parseBattleDate(battle: any, ...fields: string[]): Date | null {
  for (const field of fields) {
    if (battle?.[field]) {
      const parsed = new Date(battle[field]);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

function createEmptyBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    active: false,
    battleId: null,

    teamACaptain: null,
    teamBCaptain: null,
    teamAMembers: [],
    teamBMembers: [],
    teamAScore: 0,
    teamBScore: 0,

    hostId: null,
    challengerId: null,
    broadcasterScore: 0,
    challengerScore: 0,
    hostReady: false,
    opponentReady: false,

    startedAt: null,
    endsAt: null,
    suddenDeath: false,
    status: 'idle',
    scheduledStartAt: null,

    ...overrides,
  };
}

function normalizeBattleState(battle: any, previous?: BattleState): BattleState {
  const status: BattleStatus = isValidBattleStatus(battle?.status)
    ? battle.status
    : previous?.status || 'idle';

  const teamACaptain =
    battle?.team_a_captain ||
    battle?.host_id ||
    battle?.broadcaster_id ||
    previous?.teamACaptain ||
    null;

  const teamBCaptain =
    battle?.team_b_captain ||
    battle?.challenger_id ||
    battle?.opponent_id ||
    previous?.teamBCaptain ||
    null;

  const teamAScore =
    Number(battle?.team_a_score ?? battle?.broadcaster_score ?? previous?.teamAScore ?? 0) || 0;

  const teamBScore =
    Number(battle?.team_b_score ?? battle?.challenger_score ?? previous?.teamBScore ?? 0) || 0;

  return {
    active: status === 'active',
    battleId: battle?.id || previous?.battleId || null,

    teamACaptain,
    teamBCaptain,
    teamAMembers: Array.isArray(battle?.team_a_member_ids)
      ? battle.team_a_member_ids
      : previous?.teamAMembers || [],
    teamBMembers: Array.isArray(battle?.team_b_member_ids)
      ? battle.team_b_member_ids
      : previous?.teamBMembers || [],
    teamAScore,
    teamBScore,

    hostId: battle?.host_id || teamACaptain || previous?.hostId || null,
    challengerId: battle?.challenger_id || battle?.opponent_id || teamBCaptain || previous?.challengerId || null,
    broadcasterScore: Number(battle?.broadcaster_score ?? battle?.team_a_score ?? previous?.broadcasterScore ?? 0) || 0,
    challengerScore: Number(battle?.challenger_score ?? battle?.team_b_score ?? previous?.challengerScore ?? 0) || 0,
    hostReady: Boolean(battle?.host_ready ?? previous?.hostReady ?? false),
    opponentReady: Boolean(battle?.opponent_ready ?? previous?.opponentReady ?? false),

    startedAt:
      parseBattleDate(battle, 'started_at', 'start_time') ||
      previous?.startedAt ||
      null,
    endsAt:
      parseBattleDate(battle, 'ends_at', 'end_time', 'ended_at') ||
      previous?.endsAt ||
      null,
    suddenDeath: Boolean(battle?.sudden_death ?? previous?.suddenDeath ?? false),
    status,
    scheduledStartAt:
      parseBattleDate(battle, 'scheduled_start_at', 'start_time') ||
      previous?.scheduledStartAt ||
      null,
  };
}

function logRealtimeStatus(
  label: string,
  status: string,
  err: unknown,
  intentionalCleanup: boolean,
  context: Record<string, unknown>
) {
  if (status === 'CLOSED') {
    if (intentionalCleanup) {
      if (import.meta.env.DEV) {
        console.debug(`[BattleState] ${label} closed by cleanup`, context);
      }
      return;
    }

    console.warn(`[BattleState] ${label} closed unexpectedly`, { ...context, err });
    return;
  }

  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.warn(`[BattleState] ${label} status:`, status, { ...context, err });
    return;
  }

  if (import.meta.env.DEV) {
    console.log(`[BattleState] ${label} status:`, status, context);
  }
}

export function useBattleState({ streamId, localUserId, isHost, hostId }: UseBattleStateProps) {
  const [battleState, setBattleState] = useState<BattleState>(() => createEmptyBattleState());
  const [supporters, setSupporters] = useState<Map<string, BattleSupporter>>(new Map());
  const [userTeam, setUserTeam] = useState<'broadcaster' | 'challenger' | null>(null);
  const [joinWindowOpen, setJoinWindowOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const opponentChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearJoinWindowTimer = useCallback(() => {
    if (joinWindowTimerRef.current) {
      clearTimeout(joinWindowTimerRef.current);
      joinWindowTimerRef.current = null;
    }
  }, []);

  const openJoinWindowBriefly = useCallback(() => {
    setJoinWindowOpen(true);
    clearJoinWindowTimer();

    joinWindowTimerRef.current = setTimeout(() => {
      setJoinWindowOpen(false);
      joinWindowTimerRef.current = null;
    }, 10000);
  }, [clearJoinWindowTimer]);

  const applyBattle = useCallback(
    (battle: any) => {
      setBattleState((prev) => normalizeBattleState(battle, prev));

      const teamBCaptain = battle?.team_b_captain || battle?.challenger_id || battle?.opponent_id;
      const teamACaptain = battle?.team_a_captain || battle?.host_id || battle?.broadcaster_id;

      if (localUserId && localUserId === teamBCaptain) {
        setUserTeam('challenger');
      } else if (localUserId && localUserId === teamACaptain) {
        setUserTeam('broadcaster');
      }
    },
    [localUserId]
  );

  // Single battle-id channel. Once battleId exists, both broadcasts listen to the same battle row.
  useEffect(() => {
    if (!battleState.battleId) return;

    const battleId = battleState.battleId;
    let intentionalCleanup = false;

    const battleChannel = supabase.channel(`battle-state:${battleId}`);

    battleChannel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `id=eq.${battleId}`,
        },
        (payload) => {
          applyBattle(payload.new);
        }
      )
      .subscribe((status, err) => {
        logRealtimeStatus('Battle state channel', status, err, intentionalCleanup, {
          battleId,
          channelName: `battle-state:${battleId}`,
        });
      });

    return () => {
      intentionalCleanup = true;
      supabase.removeChannel(battleChannel);
    };
  }, [battleState.battleId, applyBattle]);

  // Stream channel. Keep it subscribed for this stream so either broadcast can see battle_id changes.
  useEffect(() => {
    if (!streamId || streamId === 'undefined') return;

    let intentionalCleanup = false;
    const channelName = `stream-battle:${streamId}`;
    const streamChannel = supabase.channel(channelName);

    streamChannel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Stream updated:', payload.new);

          if (payload.new?.battle_id && payload.new.battle_id !== battleState.battleId) {
            console.log('[BattleState] Battle confirmed for this stream:', payload.new.battle_id);
            setBattleState((prev) => ({
              ...prev,
              battleId: payload.new.battle_id,
            }));
          }

          if (!payload.new?.battle_id && payload.old?.battle_id) {
            setBattleState(createEmptyBattleState());
            setSupporters(new Map());
            setUserTeam(null);
            setJoinWindowOpen(false);
            clearJoinWindowTimer();
          }
        }
      )
      .subscribe((status, err) => {
        logRealtimeStatus('Stream channel', status, err, intentionalCleanup, {
          streamId,
          channelName,
        });
      });

    return () => {
      intentionalCleanup = true;
      supabase.removeChannel(streamChannel);
    };
  }, [streamId, battleState.battleId, clearJoinWindowTimer]);

  // Server-authoritative timer.
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const updateTimer = () => {
      const now = Date.now();

      if (battleState.status === 'countdown' && battleState.scheduledStartAt) {
        const remaining = Math.max(
          0,
          Math.floor((battleState.scheduledStartAt.getTime() - now) / 1000)
        );
        setRemainingTime(remaining);
        return;
      }

      if (battleState.status === 'active' && battleState.endsAt) {
        const remaining = Math.max(
          0,
          Math.floor((battleState.endsAt.getTime() - now) / 1000)
        );
        setRemainingTime(remaining);

        if (remaining <= 10 && remaining > 0 && !battleState.suddenDeath) {
          setBattleState((prev) => ({ ...prev, suddenDeath: true }));
        }

        return;
      }

      setRemainingTime(0);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [battleState.status, battleState.scheduledStartAt, battleState.endsAt, battleState.suddenDeath]);

  // Fetch battle on mount and subscribe to both sides of battle changes.
  useEffect(() => {
    if (!streamId || streamId === 'undefined') return;

    let cancelled = false;
    let intentionalCleanup = false;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (opponentChannelRef.current) {
      supabase.removeChannel(opponentChannelRef.current);
      opponentChannelRef.current = null;
    }

    const fetchCurrentBattle = async () => {
      try {
        const queries = [
          supabase
            .from('battles')
            .select('*')
            .eq('team_a_stream_id', streamId)
            .in('status', ACTIVE_BATTLE_STATUSES)
            .maybeSingle(),
          supabase
            .from('battles')
            .select('*')
            .eq('team_b_stream_id', streamId)
            .in('status', ACTIVE_BATTLE_STATUSES)
            .maybeSingle(),
          supabase
            .from('battles')
            .select('*')
            .eq('challenger_stream_id', streamId)
            .in('status', ACTIVE_BATTLE_STATUSES)
            .maybeSingle(),
          supabase
            .from('battles')
            .select('*')
            .eq('opponent_stream_id', streamId)
            .in('status', ACTIVE_BATTLE_STATUSES)
            .maybeSingle(),
        ];

        const results = await Promise.allSettled(queries);

        const currentBattle = results
          .map((result) => {
            if (result.status !== 'fulfilled') return null;
            if (result.value.error) return null;
            return result.value.data;
          })
          .find(Boolean);

        if (!cancelled && currentBattle) {
          console.log('[BattleState] Found battle on mount:', currentBattle.id);
          applyBattle(currentBattle);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[BattleState] Error fetching current battle:', err);
        }
      }
    };

    fetchCurrentBattle();

    const mainChannelName = `battle-stream:${streamId}:${localUserId || 'anon'}`;
    const channel = supabase
      .channel(mainChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battles',
          filter: `team_a_stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Battle INSERT received:', payload.new);
          applyBattle(payload.new);
          openJoinWindowBriefly();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battles',
          filter: `team_b_stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Battle INSERT received:', payload.new);
          applyBattle(payload.new);
          openJoinWindowBriefly();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `team_a_stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Battle UPDATE received:', payload.new);
          applyBattle(payload.new);

          if (payload.new?.status === 'ended') {
            setJoinWindowOpen(false);
            clearJoinWindowTimer();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `team_b_stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Battle UPDATE received:', payload.new);
          applyBattle(payload.new);

          if (payload.new?.status === 'ended') {
            setJoinWindowOpen(false);
            clearJoinWindowTimer();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `challenger_stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Battle UPDATE received:', payload.new);
          applyBattle(payload.new);

          if (payload.new?.status === 'ended') {
            setJoinWindowOpen(false);
            clearJoinWindowTimer();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_supporters',
        },
        (payload) => {
          const newSupporter = payload.new;

          setSupporters((prev) => {
            const newMap = new Map(prev);
            newMap.set(newSupporter.user_id, {
              userId: newSupporter.user_id,
              team: newSupporter.team,
            });
            return newMap;
          });

          if (newSupporter.user_id === localUserId) {
            setUserTeam(newSupporter.team);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_supporters',
        },
        (payload) => {
          const updated = payload.new;

          setSupporters((prev) => {
            const newMap = new Map(prev);
            newMap.set(updated.user_id, {
              userId: updated.user_id,
              team: updated.team,
            });
            return newMap;
          });

          if (updated.user_id === localUserId) {
            setUserTeam(updated.team);
          }
        }
      )
      .subscribe((status, err) => {
        logRealtimeStatus('Battle channel', status, err, intentionalCleanup, {
          streamId,
          localUserId,
          channelName: mainChannelName,
        });
      });

    channelRef.current = channel;

    const opponentChannelName = `battle-opponent:${streamId}:${localUserId || 'anon'}`;
    const opponentChannel = supabase
      .channel(opponentChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `opponent_stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('[BattleState] Opponent battle UPDATE received:', payload.new);
          applyBattle(payload.new);

          if (payload.new?.status === 'ended') {
            setJoinWindowOpen(false);
            clearJoinWindowTimer();
          }
        }
      )
      .subscribe((status, err) => {
        logRealtimeStatus('Opponent channel', status, err, intentionalCleanup, {
          streamId,
          localUserId,
          channelName: opponentChannelName,
        });
      });

    opponentChannelRef.current = opponentChannel;

    return () => {
      cancelled = true;
      intentionalCleanup = true;

      if (channelRef.current === channel) {
        channelRef.current = null;
      }

      if (opponentChannelRef.current === opponentChannel) {
        opponentChannelRef.current = null;
      }

      supabase.removeChannel(channel);
      supabase.removeChannel(opponentChannel);
      clearJoinWindowTimer();
    };
  }, [streamId, localUserId, applyBattle, openJoinWindowBriefly, clearJoinWindowTimer]);

  const startBattle = useCallback(
    async (opponentId: string, opponentStreamId: string) => {
      if (!localUserId || !streamId || !opponentId || !opponentStreamId) {
        console.error('[BattleState] Cannot start battle: missing required parameters');
        return;
      }

      try {
        console.log('[BattleState] Starting battle:', {
          streamId,
          hostId,
          opponentId,
          opponentStreamId,
        });

        const { data, error } = await supabase.functions.invoke('battles', {
          body: {
            action: 'start_battle',
            stream_id: streamId,
            host_id: hostId,
            opponent_id: opponentId,
            opponent_stream_id: opponentStreamId,
          },
        });

        if (error) {
          console.error('[BattleState] Error starting battle:', error);
          return;
        }

        console.log('[BattleState] Battle created response:', data);

        if (data?.battle) {
          setBattleState((prev) =>
            normalizeBattleState(
              {
                ...data.battle,
                status: data.battle.status || 'pending',
                challenger_id: data.battle.challenger_id || data.battle.opponent_id,
                scheduled_start_at: data.battle.scheduled_start_at,
              },
              prev
            )
          );
          openJoinWindowBriefly();
        }
      } catch (err) {
        console.error('[BattleState] Exception starting battle:', err);
      }
    },
    [streamId, localUserId, hostId, openJoinWindowBriefly]
  );

  // Listen for forfeit events.
  useEffect(() => {
    if (!battleState.battleId) return;

    const battleId = battleState.battleId;
    let intentionalCleanup = false;

    const forfeitChannel = supabase.channel(`battle:${battleId}`);

    forfeitChannel
      .on('broadcast', { event: 'battle_forfeited' }, (payload) => {
        const data = payload.payload;

        setBattleState(createEmptyBattleState());
        setSupporters(new Map());
        setUserTeam(null);
        setJoinWindowOpen(false);
        clearJoinWindowTimer();

        const isWinner = (data.winner === 'A' && isHost) || (data.winner === 'B' && !isHost);

        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('battle:ended', {
              detail: { victory: isWinner, crowns: isWinner ? 2 : 0 },
            })
          );
        }, 1500);
      })
      .subscribe((status, err) => {
        logRealtimeStatus('Forfeit channel', status, err, intentionalCleanup, {
          battleId,
          channelName: `battle:${battleId}`,
        });
      });

    return () => {
      intentionalCleanup = true;
      supabase.removeChannel(forfeitChannel);
    };
  }, [battleState.battleId, isHost, clearJoinWindowTimer]);

  const confirmBattleReady = useCallback(async () => {
    if (!battleState.battleId) {
      console.error('[BattleState] No active battle to confirm ready');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('battles', {
        body: {
          action: 'confirm_battle_screen',
          battle_id: battleState.battleId,
        },
      });

      if (error) {
        console.error('[BattleState] Error confirming ready:', error);
        return;
      }

      console.log('[BattleState] Ready confirmed:', data);

      if (data?.countdown_started) {
        setBattleState((prev) => ({
          ...prev,
          status: 'countdown',
          scheduledStartAt: new Date(data.start_time),
          hostReady: true,
          opponentReady: true,
        }));
      } else {
        setBattleState((prev) => ({
          ...prev,
          hostReady: Boolean(data?.host_confirmed),
          opponentReady: Boolean(data?.opponent_confirmed),
        }));
      }
    } catch (err) {
      console.error('[BattleState] Exception confirming ready:', err);
    }
  }, [battleState.battleId]);

  const pickSide = useCallback(
    async (team: 'broadcaster' | 'challenger') => {
      if (!battleState.battleId || !localUserId) {
        console.error('[BattleState] Cannot pick side: missing battle or user');
        return;
      }

      try {
        await supabase.rpc('pick_battle_side', {
          p_battle_id: battleState.battleId,
          p_user_id: localUserId,
          p_team: team,
        });

        setUserTeam(team);
      } catch (err) {
        console.error('[BattleState] Error picking side:', err);
      }
    },
    [battleState.battleId, localUserId]
  );

  const endBattle = useCallback(async () => {
    if (!battleState.battleId) {
      console.error('[BattleState] No active battle to end');
      return;
    }

    try {
      await supabase.rpc('end_battle', {
        p_battle_id: battleState.battleId,
      });

      setBattleState(createEmptyBattleState());
      setSupporters(new Map());
      setUserTeam(null);
      setJoinWindowOpen(false);
      clearJoinWindowTimer();
    } catch (err) {
      console.error('[BattleState] Error ending battle:', err);
    }
  }, [battleState.battleId, clearJoinWindowTimer]);

  const isBroadcasterTeam = useCallback(() => {
    return userTeam === 'broadcaster';
  }, [userTeam]);

  const isChallengerTeam = useCallback(() => {
    return userTeam === 'challenger';
  }, [userTeam]);

  const canGift = useCallback(() => {
    if (!battleState.active) return true;

    if (
      localUserId === battleState.hostId ||
      localUserId === battleState.challengerId ||
      localUserId === battleState.teamACaptain ||
      localUserId === battleState.teamBCaptain
    ) {
      return false;
    }

    return true;
  }, [battleState, localUserId]);

  const getRemainingTime = useCallback(() => {
    if (!battleState.endsAt) return 0;
    const remaining = battleState.endsAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }, [battleState.endsAt]);

  const sendBattleGift = useCallback(
    async (team: 'broadcaster' | 'challenger', amount: number) => {
      if (!battleState.battleId || !localUserId) {
        console.error('[BattleState] Cannot send battle gift: missing battle or user');
        return false;
      }

      try {
        await supabase.rpc('record_battle_gift', {
          p_battle_id: battleState.battleId,
          p_sender_id: localUserId,
          p_team: team,
          p_amount: amount,
        });

        return true;
      } catch (err) {
        console.error('[BattleState] Error sending battle gift:', err);
        return false;
      }
    },
    [battleState.battleId, localUserId]
  );

  const shouldShowSidePicker = useCallback(() => {
    if (!battleState.active) return false;
    if (localUserId === battleState.hostId) return false;
    if (localUserId === battleState.challengerId) return false;
    if (localUserId === battleState.teamACaptain) return false;
    if (localUserId === battleState.teamBCaptain) return false;
    return true;
  }, [battleState, localUserId]);

  return {
    battleState,
    supporters,
    userTeam,
    joinWindowOpen,
    remainingTime,
    startBattle,
    confirmBattleReady,
    pickSide,
    endBattle,
    isBroadcasterTeam,
    isChallengerTeam,
    canGift,
    getRemainingTime,
    sendBattleGift,
    shouldShowSidePicker,
  };
}