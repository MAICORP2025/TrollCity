/**
 * useJailTime — Drop-in hook for JAIL TIME battle effects.
 *
 * Provides everything needed to add jail bar overlays to any battle view:
 *   - Losing state for each side
 *   - Lead change detection
 *   - Sound effect triggers
 *   - Ambient audio management
 *
 * Usage in BattleView or any battle component:
 *
 *   const {
 *     challengerLosing,
 *     opponentLosing,
 *     leadChanged,
 *     challengerVideoRef,
 *     opponentVideoRef,
 *     JailOverlays,
 *   } = useJailTime({
 *     challengerScore,
 *     opponentScore,
 *     battleActive: battleStatus === 'active',
 *     soundEnabled: true,
 *     ambientEnabled: true,
 *   });
 *
 *   // In JSX:
 *   <div ref={challengerVideoRef} className="...">
 *     {challengerLosing && <JailBarOverlay side="challenger" isLosing={true} />}
 *     ...
 *   </div>
 *   <div ref={opponentVideoRef} className="...">
 *     {opponentLosing && <JailBarOverlay side="opponent" isLosing={true} />}
 *     ...
 *   </div>
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { JailTimeSounds } from '../lib/jailTimeSounds';

export interface UseJailTimeOptions {
  challengerScore: number;
  opponentScore: number;
  battleActive: boolean;
  soundEnabled?: boolean;
  ambientEnabled?: boolean;
  ambientVolume?: number;
}

export interface UseJailTimeReturn {
  /** Is challenger side currently losing? */
  challengerLosing: boolean;
  /** Is opponent side currently losing? */
  opponentLosing: boolean;
  /** Did the lead just change? (resets after 1s) */
  leadChanged: boolean;
  /** Current score difference (always positive) */
  scoreDifference: number;
  /** Who is currently leading */
  currentLeader: 'challenger' | 'opponent' | 'tie';
  /** Ref to attach to challenger's video container */
  challengerVideoRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to attach to opponent's video container */
  opponentVideoRef: React.RefObject<HTMLDivElement | null>;
  /** Callback when challenger bars lock (for custom sound handling) */
  onChallengerJailLock: () => void;
  /** Callback when challenger bars unlock */
  onChallengerJailUnlock: () => void;
  /** Callback when opponent bars lock */
  onOpponentJailLock: () => void;
  /** Callback when opponent bars unlock */
  onOpponentJailUnlock: () => void;
  /** Manually stop all jail time audio */
  stopAllAudio: () => void;
}

export function useJailTime({
  challengerScore,
  opponentScore,
  battleActive,
  soundEnabled = true,
  ambientEnabled = true,
  ambientVolume = 0.04,
}: UseJailTimeOptions): UseJailTimeReturn {
  // ── State ────────────────────────────────────────────────────
  const [challengerLosing, setChallengerLosing] = useState(false);
  const [opponentLosing, setOpponentLosing] = useState(false);
  const [leadChanged, setLeadChanged] = useState(false);

  // Refs
  const prevLeaderRef = useRef<'challenger' | 'opponent' | 'tie' | null>(null);
  const prevScoreDiff = useRef(0);
  const comboCountRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const challengerVideoRef = useRef<HTMLDivElement | null>(null);
  const opponentVideoRef = useRef<HTMLDivElement | null>(null);

  // ── Derived values ────────────────────────────────────────────
  const scoreDifference = useMemo(
    () => Math.abs(challengerScore - opponentScore),
    [challengerScore, opponentScore]
  );

  const currentLeader = useMemo((): 'challenger' | 'opponent' | 'tie' => {
    if (challengerScore > opponentScore) return 'challenger';
    if (opponentScore > challengerScore) return 'opponent';
    return 'tie';
  }, [challengerScore, opponentScore]);

  // ── Score tracking effect ────────────────────────────────────
  useEffect(() => {
    if (!battleActive) {
      setChallengerLosing(false);
      setOpponentLosing(false);
      setLeadChanged(false);
      prevLeaderRef.current = null;
      comboCountRef.current = 0;
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (leadChangeTimerRef.current) clearTimeout(leadChangeTimerRef.current);
      return;
    }

    const newChallengerLosing = opponentScore > challengerScore;
    const newOpponentLosing = challengerScore > opponentScore;

    // Lead change detection
    const prevLeader = prevLeaderRef.current;
    const didLeadChange = prevLeader !== null
      && currentLeader !== prevLeader
      && currentLeader !== 'tie';

    if (didLeadChange && soundEnabled) {
      JailTimeSounds.leadChange();
      setLeadChanged(true);

      // Reset lead changed flag after 1s
      if (leadChangeTimerRef.current) clearTimeout(leadChangeTimerRef.current);
      leadChangeTimerRef.current = setTimeout(() => setLeadChanged(false), 1000);

      // Combo detection
      comboCountRef.current++;
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        if (comboCountRef.current >= 3) {
          JailTimeSounds.jailCombo();
        }
        comboCountRef.current = 0;
      }, 5000);

      // Victory stinger for big swings
      if (scoreDifference > 2000) {
        setTimeout(() => JailTimeSounds.victoryStinger(), 300);
      }
    }

    // Score swing detection
    const diffIncrease = scoreDifference - prevScoreDiff.current;
    if (diffIncrease > 500 && soundEnabled) {
      const severity = diffIncrease > 5000 ? 'large' as const
        : diffIncrease > 1000 ? 'medium' as const
        : 'small' as const;
      JailTimeSounds.scoreSwing(severity);
    }
    prevScoreDiff.current = scoreDifference;

    // Tension riser for close battles
    if (battleActive && scoreDifference < 500 && scoreDifference > 0 && soundEnabled) {
      if (Math.random() > 0.92) {
        JailTimeSounds.tensionRiser();
      }
    }

    prevLeaderRef.current = currentLeader;
    setChallengerLosing(newChallengerLosing);
    setOpponentLosing(newOpponentLosing);
  }, [challengerScore, opponentScore, battleActive, soundEnabled, currentLeader, scoreDifference]);

  // ── Ambient audio ────────────────────────────────────────────
  useEffect(() => {
    if (battleActive && ambientEnabled && soundEnabled) {
      if (!JailTimeSounds.isAmbientPlaying()) {
        JailTimeSounds.startAmbient(ambientVolume);
      }
    } else {
      if (JailTimeSounds.isAmbientPlaying()) {
        JailTimeSounds.stopAmbient();
      }
    }

    return () => {
      if (JailTimeSounds.isAmbientPlaying()) {
        JailTimeSounds.stopAmbient();
      }
    };
  }, [battleActive, ambientEnabled, soundEnabled, ambientVolume]);

  // ── Sound callbacks ──────────────────────────────────────────
  const onChallengerJailLock = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailLock();
  }, [soundEnabled]);

  const onChallengerJailUnlock = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailUnlock();
  }, [soundEnabled]);

  const onOpponentJailLock = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailLock();
  }, [soundEnabled]);

  const onOpponentJailUnlock = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailUnlock();
  }, [soundEnabled]);

  const stopAllAudio = useCallback(() => {
    JailTimeSounds.stopAmbient();
  }, []);

  return {
    challengerLosing,
    opponentLosing,
    leadChanged,
    scoreDifference,
    currentLeader,
    challengerVideoRef,
    opponentVideoRef,
    onChallengerJailLock,
    onChallengerJailUnlock,
    onOpponentJailLock,
    onOpponentJailUnlock,
    stopAllAudio,
  };
}
