import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RANDOM_BATTLE_ENABLED } from '../config/featureFlags';
import { supabase } from '../lib/supabase';
import type { Stream } from '../types/broadcast';

type QueuePhase = 'regular' | 'queue' | 'starting' | 'active' | 'ended';

interface Options {
  stream: Stream | null;
  userId?: string;
  isBroadcaster: boolean;
  onStreamUpdate?: (patch: Partial<Stream>) => void;
}

const QUEUE_DELAY_MS = 10_000;
const POLL_INTERVAL_MS = 30_000;

export function useRandomBattleQueueController({
  stream,
  userId,
  isBroadcaster,
  onStreamUpdate,
}: Options) {
  const [isBusy, setIsBusy] = useState(false);
  const [delayUntil, setDelayUntil] = useState<number | null>(null);
  const [battleStartsAt, setBattleStartsAt] = useState<number | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const activationTimerRef = useRef<number | null>(null);
  const autoQueueTimerRef = useRef<number | null>(null);
  const shouldAutoQueueRef = useRef(false);
  const matchingRef = useRef(false);
  const activatingRef = useRef(false);

  const isGeneralChat = stream?.category === 'general';
  const isQueueEnabled = !!stream?.random_battle_queue_enabled;
  const hasActiveBattleRef = !!stream?.battle_id && !!stream?.is_battle;
  const isRandomBattle = stream?.battle_mode === 'random_queue' && hasActiveBattleRef;
  const isBattleActive = hasActiveBattleRef && (
    stream?.battle_status === 'active'
    || stream?.battle_status === 'starting'
    || !stream?.battle_status
  );
  const canUseRandomBattles = RANDOM_BATTLE_ENABLED && isGeneralChat && isBroadcaster && !!stream?.id && !!userId;

  const phase: QueuePhase = useMemo(() => {
    if (stream?.status === 'ended') return 'ended';
    if (isRandomBattle && stream?.battle_status === 'starting') return 'starting';
    if (isRandomBattle && isBattleActive) return 'active';
    if (isQueueEnabled) return 'queue';
    return 'regular';
  }, [isBattleActive, isQueueEnabled, isRandomBattle, stream?.battle_status, stream?.status]);

  useEffect(() => {
    if (isQueueEnabled) {
      shouldAutoQueueRef.current = true;
    }
  }, [isQueueEnabled]);

  const clearAutoQueueTimer = useCallback(() => {
    if (autoQueueTimerRef.current) window.clearTimeout(autoQueueTimerRef.current);
    autoQueueTimerRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    delayTimerRef.current = null;
    pollTimerRef.current = null;
    setDelayUntil(null);
    clearAutoQueueTimer();
  }, [clearAutoQueueTimer]);

  const clearActivationTimer = useCallback(() => {
    if (activationTimerRef.current) window.clearTimeout(activationTimerRef.current);
    activationTimerRef.current = null;
    setBattleStartsAt(null);
  }, []);

  const findMatch = useCallback(async (force: boolean = false) => {
    console.log('[RandomBattleQueue] findMatch called:', { hasId: !!stream?.id, hasUserId: !!userId, matching: matchingRef.current, canUse: canUseRandomBattles, isBattleActive, status: stream?.status, isQueueEnabled, force });
    if (!stream?.id || !userId || matchingRef.current) return;
    if (!canUseRandomBattles || isBattleActive || stream.status !== 'live') return;
    if (!isQueueEnabled && !force) return;

    console.log('[RandomBattleQueue] calling find_random_battle_match RPC');
    matchingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('find_random_battle_match', {
        p_stream_id: stream.id,
        p_broadcaster_id: userId,
      });

      if (error) throw error;

      if (data?.matched) {
        console.log('[RandomBattleQueue] MATCH FOUND, battle_id:', data.battle_id, 'started_at:', data.battle_started_at);
        clearActivationTimer();
        onStreamUpdate?.({
          is_battle: true,
          battle_id: data.battle_id,
          battle_mode: 'random_queue' as any,
          battle_status: 'starting' as any,
          random_battle_queue_enabled: false,
          random_battle_queued_at: null,
          random_battle_cooldown_until: null,
          battle_start_time: data.battle_started_at,
          battle_end_time: data.battle_ends_at,
          battle_end_reason: null,
          battle_winner_id: null,
          battle_forfeited_by: null,
        } as Partial<Stream>);
        toast.success('Battle activated');
      }
    } catch (err: any) {
      console.error('[RandomBattleQueue] Matchmaking failed:', err);
    } finally {
      matchingRef.current = false;
    }
  }, [canUseRandomBattles, clearActivationTimer, isBattleActive, isQueueEnabled, onStreamUpdate, stream?.id, stream?.status, userId]);

  useEffect(() => {
    clearTimers();

    if (!canUseRandomBattles || !isQueueEnabled || isBattleActive || stream?.status !== 'live') return;

    const queuedAt = stream.random_battle_queued_at
      ? new Date(stream.random_battle_queued_at).getTime()
      : null;
    // UX requirement: always show a fixed 10s countdown after returning to broadcast.
    const firstRunAt = queuedAt ? queuedAt + QUEUE_DELAY_MS : Date.now() + QUEUE_DELAY_MS;
    const delay = Math.max(0, firstRunAt - Date.now());
    setDelayUntil(firstRunAt);

    delayTimerRef.current = window.setTimeout(() => {
      setDelayUntil(null);
      void findMatch();
      pollTimerRef.current = window.setInterval(() => {
        void findMatch();
      }, POLL_INTERVAL_MS);
    }, delay);

    return clearTimers;
  }, [canUseRandomBattles, clearTimers, findMatch, isBattleActive, isQueueEnabled, stream?.random_battle_queued_at, stream?.status]);

  const startQueue = useCallback(async () => {
    if (!canUseRandomBattles || !stream?.id) return;
    console.log('[RandomBattleQueue] startQueue called, streamId:', stream.id);
    setIsBusy(true);
    try {
      const queuedAt = new Date().toISOString();
      console.log('[RandomBattleQueue] setting random_battle_queue_enabled=true in DB');
      const { data, error } = await supabase
        .from('streams')
        .update({
          random_battle_queue_enabled: true,
          random_battle_queued_at: queuedAt,
        })
        .select('random_battle_queue_enabled, random_battle_queued_at, random_battle_cooldown_until')
        .eq('id', stream.id);
      if (error) throw error;
      const row = data?.[0];
      onStreamUpdate?.({
        random_battle_queue_enabled: true,
        random_battle_queued_at: row?.random_battle_queued_at ?? queuedAt,
        random_battle_cooldown_until: row?.random_battle_cooldown_until ?? null,
      } as Partial<Stream>);
      shouldAutoQueueRef.current = true;
      toast.success('Random Battle Queue enabled');

      // Immediately attempt to match if possible, even before local stream state refreshes.
      if (stream?.status === 'live' && !isBattleActive) {
        void findMatch(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start random battles');
    } finally {
      setIsBusy(false);
    }
  }, [canUseRandomBattles, findMatch, isBattleActive, onStreamUpdate, stream?.id, stream?.status]);

  const stopQueue = useCallback(async () => {
    if (!stream?.id) return;
    setIsBusy(true);
    try {
      const { error } = await supabase
        .from('streams')
        .update({
          random_battle_queue_enabled: false,
          random_battle_queued_at: null,
        })
        .eq('id', stream.id);
      if (error) throw error;
      clearTimers();
      clearAutoQueueTimer();
      shouldAutoQueueRef.current = false;
      onStreamUpdate?.({ random_battle_queue_enabled: false, random_battle_queued_at: null } as Partial<Stream>);
      toast.success('Random Battle Queue stopped');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to stop random battles');
    } finally {
      setIsBusy(false);
    }
  }, [clearAutoQueueTimer, clearTimers, onStreamUpdate, stream?.id]);

  useEffect(() => {
    clearAutoQueueTimer();
    if (!canUseRandomBattles || stream?.status !== 'live' || !shouldAutoQueueRef.current) return;
    if (isQueueEnabled || hasActiveBattleRef) return;

    autoQueueTimerRef.current = window.setTimeout(() => {
      autoQueueTimerRef.current = null;
      if (!hasActiveBattleRef && !isQueueEnabled && shouldAutoQueueRef.current && stream?.status === 'live') {
        void startQueue();
      }
    }, 30_000);

    return clearAutoQueueTimer;
  }, [canUseRandomBattles, clearAutoQueueTimer, hasActiveBattleRef, isQueueEnabled, startQueue, stream?.status]);

  // Track which battle we are currently managing activation for.
  const activatedBattleIdRef = useRef<string | null>(null);
  const lastActivatedIdRef = useRef<string | null>(null);
  const activationDelayRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream?.id || !stream.battle_id || !isRandomBattle || stream.battle_status !== 'starting') {
      lastActivatedIdRef.current = null;
      return;
    }

    const currentBattleId = stream.battle_id;

    if (activatedBattleIdRef.current === currentBattleId) {
      return;
    }

    if (lastActivatedIdRef.current !== currentBattleId && lastActivatedIdRef.current !== null) {
      clearActivationTimer();
    }

    activatedBattleIdRef.current = currentBattleId;
    lastActivatedIdRef.current = currentBattleId;
    activationDelayRef.current = null;

    const syncCountdownAndMaybeActivate = async () => {
      const currentBattleIdForSync = stream.battle_id;
      if (activatedBattleIdRef.current !== currentBattleIdForSync) return;

      let startsAt = stream.battle_start_time ? new Date(stream.battle_start_time).getTime() : 0;

      if (!startsAt || Number.isNaN(startsAt)) {
        try {
          const { data: battleRow } = await supabase
            .from('battles')
            .select('started_at, created_at')
            .eq('id', currentBattleIdForSync)
            .maybeSingle();
          if (battleRow?.started_at) {
            startsAt = new Date(battleRow.started_at).getTime();
          } else if (battleRow?.created_at) {
            startsAt = new Date(battleRow.created_at).getTime() + 5_000;
          }
        } catch (err) {
          console.warn('[RandomBattleQueue] Could not fetch battle started_at fallback:', err);
        }
      }

      if (!startsAt || Number.isNaN(startsAt)) {
        startsAt = Date.now() + 1_000;
      }

      const delay = Math.max(0, startsAt - Date.now());
      setBattleStartsAt(startsAt);
      activationDelayRef.current = delay;

      activationTimerRef.current = window.setTimeout(async () => {
        activationDelayRef.current = null;

        if (activatedBattleIdRef.current !== currentBattleIdForSync) return;
        if (activatingRef.current) return;

        if (!isBroadcaster || !userId) return;

        activatingRef.current = true;
        try {
          const { data, error } = await supabase.rpc('activate_random_battle', {
            p_battle_id: currentBattleIdForSync,
          });

          if (error) throw error;
          if (data?.success && activatedBattleIdRef.current === currentBattleIdForSync) {
            onStreamUpdate?.({ battle_status: 'active' as any } as Partial<Stream>);
          }
        } catch (err) {
          console.error('[RandomBattleQueue] Failed to activate battle:', err);
        } finally {
          activatingRef.current = false;
        }
      }, delay);
    };

    void syncCountdownAndMaybeActivate();

    return () => {
      clearActivationTimer();
      activatedBattleIdRef.current = null;
      activationDelayRef.current = null;
      if (stream?.battle_id !== activatedBattleIdRef.current) {
        lastActivatedIdRef.current = null;
      }
    };
  }, [
    clearActivationTimer,
    isBroadcaster,
    isRandomBattle,
    onStreamUpdate,
    stream?.battle_id,
    stream?.battle_start_time,
    stream?.battle_status,
    stream?.id,
    userId,
  ]);

  const forfeitBattle = useCallback(async () => {
    if (!stream?.id || !userId || !isRandomBattle) return;
    const confirmed = window.confirm('You will lose and opponent gets 2 crowns');
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const { data, error } = await supabase.rpc('forfeit_random_battle', {
        p_stream_id: stream.id,
        p_broadcaster_id: userId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to forfeit battle');
      onStreamUpdate?.({
        is_battle: false,
        battle_id: null,
        battle_mode: 'manual' as any,
        battle_status: 'waiting' as any,
        battle_start_time: null,
        battle_end_time: new Date().toISOString(),
        battle_end_reason: 'forfeit',
        battle_winner_id: data.winner_id,
        battle_forfeited_by: userId,
        random_battle_queue_enabled: false,
        random_battle_queued_at: null,
        random_battle_cooldown_until: null,
      } as Partial<Stream>);
      toast.success('Battle forfeited');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to forfeit battle');
    } finally {
      setIsBusy(false);
    }
  }, [isRandomBattle, onStreamUpdate, stream?.id, userId]);

  return {
    canUseRandomBattles,
    isBusy,
    isQueueEnabled,
    isRandomBattle,
    isBattleActive,
    phase,
    delayUntil,
    battleStartsAt,
    startQueue,
    stopQueue,
    forfeitBattle,
  };
}