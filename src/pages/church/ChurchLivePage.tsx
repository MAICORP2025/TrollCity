import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Church,
  Clock,
  HeartHandshake,
  Home,
  Loader2,
  LogOut,
  MessageCircle,
  Mic2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';

type ChurchSessionStatus = 'scheduled' | 'starting' | 'live' | 'ended' | string;

interface PastorProfile {
  username: string | null;
  avatar_url: string | null;
  display_name?: string | null;
}

interface LiveSession {
  id: string;
  pastor_id: string;
  room_name: string | null;
  sermon_title: string | null;
  scripture_reference?: string | null;
  attendee_count: number | null;
  started_at: string | null;
  ended_at?: string | null;
  status: ChurchSessionStatus;
  created_at?: string | null;
  user_profiles: PastorProfile | null;
}

const pageBg =
  'min-h-screen bg-[radial-gradient(circle_at_top_left,#facc1530,transparent_32%),radial-gradient(circle_at_bottom_right,#fb923c20,transparent_36%),linear-gradient(135deg,#100703_0%,#211008_42%,#351807_100%)] px-3 pb-24 pt-20 text-[#FFF8E7] sm:px-4 md:px-8';

const panel =
  'rounded-[2rem] border border-[#D6B36A]/25 bg-[#1C0F08]/82 shadow-[0_0_45px_rgba(214,179,106,0.12)] backdrop-blur-xl';

const glassPanel =
  'rounded-3xl border border-[#D6B36A]/18 bg-[#120A05]/72 shadow-[inset_0_1px_0_rgba(255,248,231,0.06)] backdrop-blur-xl';

const goldButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#F6D98B]/40 bg-[#D6B36A] px-4 py-3 text-sm font-black text-[#1C0F08] shadow-[0_0_24px_rgba(214,179,106,0.22)] transition hover:bg-[#F6D98B] disabled:cursor-not-allowed disabled:opacity-50';

const darkButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D6B36A]/25 bg-[#120A05]/80 px-4 py-3 text-sm font-black text-[#FFF8E7] transition hover:border-[#F6D98B]/55 hover:bg-[#211008] disabled:cursor-not-allowed disabled:opacity-50';

const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50';

const badge =
  'inline-flex items-center gap-2 rounded-full border border-[#D6B36A]/25 bg-[#120A05]/80 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#D6B36A]';

function formatTime(value?: string | null) {
  if (!value) return 'Live now';

  try {
    return new Date(value).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Live now';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Started recently';

  try {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Started recently';
  }
}

function normalizeSession(raw: any): LiveSession {
  return {
    id: raw.id,
    pastor_id: raw.pastor_id,
    room_name: raw.room_name ?? null,
    sermon_title: raw.sermon_title ?? null,
    scripture_reference: raw.scripture_reference ?? null,
    attendee_count: Number(raw.attendee_count ?? 0),
    started_at: raw.started_at ?? null,
    ended_at: raw.ended_at ?? null,
    status: raw.status ?? 'live',
    created_at: raw.created_at ?? null,
    user_profiles: raw.user_profiles ?? null,
  };
}

export default function ChurchLivePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const joinedThisPageRef = useRef(false);
  const leavingRef = useRef(false);

  const roomId = useMemo(() => liveSession?.room_name || '', [liveSession?.room_name]);

  const audienceName = useMemo(() => {
    if (!profile) return 'Church Guest';
    return profile.username || profile.display_name || profile.email || 'Church Guest';
  }, [profile]);

  const pastorName = useMemo(() => {
    return (
      liveSession?.user_profiles?.display_name ||
      liveSession?.user_profiles?.username ||
      'Pastor'
    );
  }, [liveSession?.user_profiles?.display_name, liveSession?.user_profiles?.username]);

  const isPastor = Boolean(profile?.id && liveSession?.pastor_id && profile.id === liveSession.pastor_id);
  const isLive = liveSession?.status === 'live' || liveSession?.status === 'starting';

  const {
    isConnected,
    isJoining: liveKitJoining,
    remoteUsers,
    joinAsAudience,
    leaveRoom,
  } = useLiveKitRoom({
    roomId,
    roomType: 'church',
    role: 'viewer',
    publish: false,
    audioOnly: true,
    userName: audienceName,
    onError: (err: { message: string; }) => {
      console.error('[ChurchLivePage] LiveKit error', err);
      const message = err?.message || 'Unable to join the church service audio.';
      setJoinError(message);
      toast.error(message);
    },
  });

  const connectedViewerCount = useMemo(() => {
    return remoteUsers.length + (isConnected ? 1 : 0);
  }, [remoteUsers.length, isConnected]);

  const displayedAttendeeCount = useMemo(() => {
    const savedCount = Number(liveSession?.attendee_count ?? 0);
    return Math.max(savedCount, connectedViewerCount);
  }, [connectedViewerCount, liveSession?.attendee_count]);

  const fetchSession = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!sessionId) {
        setLoading(false);
        setSessionError('Missing church service ID.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      setSessionError(null);

      try {
        const fullSelect =
          'id,pastor_id,room_name,sermon_title,scripture_reference,attendee_count,started_at,ended_at,status,created_at,user_profiles(username,avatar_url,display_name)';

        let result = await supabase
          .from('church_live_sessions')
          .select(fullSelect)
          .eq('id', sessionId)
          .maybeSingle();

        if (result.error) {
          console.warn('[ChurchLivePage] Full session select failed, retrying minimal select:', result.error);

          result = await supabase
            .from('church_live_sessions')
            .select(
              'id,pastor_id,room_name,sermon_title,attendee_count,started_at,status,created_at,user_profiles(username,avatar_url)',
            )
            .eq('id', sessionId)
            .maybeSingle();
        }

        if (result.error) throw result.error;

        const nextSession = result.data ? normalizeSession(result.data) : null;
        setLiveSession(nextSession);

        if (!nextSession) {
          setSessionError('This church service could not be found.');
          return;
        }

        if (nextSession.status === 'ended') {
          setSessionError('This church service has ended.');
        }
      } catch (err) {
        console.error('[ChurchLivePage] fetchSession failed:', err);
        setLiveSession(null);
        setSessionError((err as any)?.message || 'Unable to load this church service.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void fetchSession('initial');
  }, [fetchSession]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`church-live-session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as any;

          if (!next?.id) {
            setLiveSession(null);
            return;
          }

          setLiveSession((current) => {
            const merged = normalizeSession({
              ...(current || {}),
              ...next,
              user_profiles: current?.user_profiles ?? null,
            });

            return merged;
          });

          if (next.status === 'ended') {
            toast.info('This church service has ended.');
            void leaveRoom().catch(() => {});
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leaveRoom, sessionId]);

  useEffect(() => {
    return () => {
      if (joinedThisPageRef.current) {
        void leaveRoom().catch(() => {});
      }
    };
  }, [leaveRoom]);

  const updateAttendeeCount = useCallback(
    async (direction: 'join' | 'leave') => {
      if (!liveSession?.id) return;

      const currentCount = Number(liveSession.attendee_count ?? 0);
      const nextCount = direction === 'join' ? currentCount + 1 : Math.max(currentCount - 1, 0);

      setLiveSession((current) =>
        current
          ? {
              ...current,
              attendee_count: nextCount,
            }
          : current,
      );

      const { error } = await supabase
        .from('church_live_sessions')
        .update({ attendee_count: nextCount })
        .eq('id', liveSession.id);

      if (error) {
        console.warn('[ChurchLivePage] attendee_count update failed:', error);
      }
    },
    [liveSession?.attendee_count, liveSession?.id],
  );

  const handleJoinService = async () => {
    if (!profile?.id) {
      toast.error('Please sign in to join the church service.');
      navigate('/login');
      return;
    }

    if (!liveSession) {
      toast.error('No church service loaded.');
      return;
    }

    if (!roomId) {
      setJoinError('This service is missing a LiveKit room name.');
      toast.error('This service is missing a LiveKit room name.');
      return;
    }

    if (!isLive) {
      toast.error('This church service is not live right now.');
      return;
    }

    setJoinError(null);

    try {
      await joinAsAudience(profile.id);

      if (!joinedThisPageRef.current) {
        joinedThisPageRef.current = true;
        await updateAttendeeCount('join');
      }

      toast.success('You joined the church service.');
    } catch (err) {
      console.error('[ChurchLivePage] join error:', err);
      const message = (err as any)?.message || 'Unable to join the church service.';
      setJoinError(message);
      toast.error(message);
    }
  };

  const handleLeaveService = async () => {
    if (leavingRef.current) return;

    leavingRef.current = true;

    try {
      await leaveRoom();

      if (joinedThisPageRef.current) {
        joinedThisPageRef.current = false;
        await updateAttendeeCount('leave');
      }

      toast.info('You left the church service.');
    } catch (err) {
      console.error('[ChurchLivePage] leave error:', err);
      toast.error('Unable to leave the service cleanly.');
    } finally {
      leavingRef.current = false;
    }
  };

  const handleRefresh = () => {
    void fetchSession('refresh');
  };

  const openChurchWall = () => {
    navigate('/church');
  };

  const openPastorDashboard = () => {
    navigate('/church/pastor');
  };

  return (
    <div className={pageBg}>
      <main className="relative z-10 mx-auto max-w-7xl space-y-5">
        <section className={`${panel} overflow-hidden`}>
          <div className="relative p-5 sm:p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-[#D6B36A]/15 blur-3xl" />
              <div className="absolute bottom-6 right-8 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={badge}>
                    <Church className="h-4 w-4" />
                    Troll Church
                  </span>

                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] ${
                      isLive
                        ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                        : 'border-yellow-300/30 bg-yellow-400/10 text-yellow-100'
                    }`}
                  >
                    <Radio className="h-4 w-4" />
                    {isLive ? 'Live Service' : liveSession?.status || 'Checking'}
                  </span>
                </div>

                <h1 className="mt-4 text-4xl font-black leading-tight text-[#FFF8E7] sm:text-5xl">
                  Live Worship Service
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#E8D7B0]/78 sm:text-base">
                  Join the live Troll Church service, listen to the pastor, receive the message, and stay connected with the community.
                </p>
              </div>

              <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button type="button" onClick={() => navigate('/church')} className={darkButton}>
                  <ArrowLeft className="h-4 w-4" />
                  Church Home
                </button>

                <button type="button" onClick={handleRefresh} disabled={refreshing} className={darkButton}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>

                {isPastor && (
                  <button type="button" onClick={openPastorDashboard} className={goldButton}>
                    <ShieldCheck className="h-4 w-4" />
                    Pastor Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className={`${panel} flex min-h-[420px] items-center justify-center p-8`}>
            <div className="text-center">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#D6B36A]" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.25em] text-[#D6B36A]">
                Loading Church Service
              </p>
              <p className="mt-2 text-sm text-[#E8D7B0]/70">Checking the live room and service details...</p>
            </div>
          </section>
        ) : !liveSession ? (
          <section className={`${panel} p-8`}>
            <div className="mx-auto max-w-xl py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#D6B36A]/25 bg-[#120A05]/80">
                <AlertTriangle className="h-8 w-8 text-[#D6B36A]" />
              </div>

              <h2 className="mt-5 text-3xl font-black text-[#FFF8E7]">No Active Service Found</h2>

              <p className="mt-3 text-sm leading-6 text-[#E8D7B0]/75">
                {sessionError ||
                  'The pastor is not live right now. Return to the church home and join when the next service begins.'}
              </p>

              <button type="button" onClick={() => navigate('/church')} className={`${goldButton} mt-6`}>
                <Home className="h-4 w-4" />
                Back to Church Home
              </button>
            </div>
          </section>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className={`${panel} overflow-hidden`}>
              <div className="border-b border-[#D6B36A]/15 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-[#D6B36A]">
                      Now Preaching
                    </p>

                    <h2 className="mt-2 text-3xl font-black text-[#FFF8E7] sm:text-4xl">
                      {liveSession.sermon_title || 'Troll Church Live Service'}
                    </h2>

                    {liveSession.scripture_reference && (
                      <p className="mt-2 inline-flex rounded-full border border-[#D6B36A]/20 bg-[#120A05]/80 px-3 py-1.5 text-sm font-bold text-[#F6D98B]">
                        Scripture: {liveSession.scripture_reference}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <div className="rounded-2xl border border-[#D6B36A]/18 bg-[#120A05]/76 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#D6B36A]">Started</p>
                      <p className="mt-1 text-sm font-black text-[#FFF8E7]">
                        {formatTime(liveSession.started_at)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#D6B36A]/18 bg-[#120A05]/76 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#D6B36A]">Attending</p>
                      <p className="mt-1 text-sm font-black text-[#FFF8E7]">
                        {displayedAttendeeCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="relative overflow-hidden rounded-[2rem] border border-[#D6B36A]/20 bg-gradient-to-br from-[#120A05] via-[#211008] to-[#3A1C0A] p-5 shadow-[0_0_55px_rgba(214,179,106,0.12)] sm:p-8">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 top-8 h-48 w-48 -translate-x-1/2 rounded-full bg-[#D6B36A]/10 blur-3xl" />
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#100703] to-transparent" />
                  </div>

                  <div className="relative mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
                    <div
                      className={`flex h-24 w-24 items-center justify-center rounded-[2rem] border shadow-[0_0_35px_rgba(214,179,106,0.18)] ${
                        isConnected
                          ? 'border-emerald-300/40 bg-emerald-400/10'
                          : 'border-[#D6B36A]/30 bg-[#120A05]/80'
                      }`}
                    >
                      {isConnected ? (
                        <Volume2 className="h-11 w-11 text-emerald-200" />
                      ) : (
                        <Mic2 className="h-11 w-11 text-[#D6B36A]" />
                      )}
                    </div>

                    <h3 className="mt-6 text-2xl font-black text-[#FFF8E7] sm:text-3xl">
                      {isConnected ? 'You are connected to the service' : 'Audio Service Ready'}
                    </h3>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#E8D7B0]/76">
                      {isConnected
                        ? 'Stay on this page to keep listening. You can leave anytime with the button below.'
                        : 'Tap Join Service to connect to the live church audio room.'}
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      {isConnected ? (
                        <button
                          type="button"
                          onClick={handleLeaveService}
                          disabled={leavingRef.current}
                          className={dangerButton}
                        >
                          {leavingRef.current ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                          Leave Service
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleJoinService}
                          disabled={liveKitJoining || !isLive}
                          className={goldButton}
                        >
                          {liveKitJoining ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Radio className="h-4 w-4" />
                          )}
                          {liveKitJoining ? 'Joining...' : isLive ? 'Join Service' : 'Service Not Live'}
                        </button>
                      )}

                      <button type="button" onClick={openChurchWall} className={darkButton}>
                        <MessageCircle className="h-4 w-4" />
                        Church Wall
                      </button>
                    </div>

                    {joinError && (
                      <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {joinError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className={`${glassPanel} p-5`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D6B36A]/20 bg-[#1C0F08]">
                        <UsersRound className="h-5 w-5 text-[#D6B36A]" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[#D6B36A]">Audience</p>
                        <p className="text-xl font-black text-[#FFF8E7]">{displayedAttendeeCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className={`${glassPanel} p-5`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D6B36A]/20 bg-[#1C0F08]">
                        <Clock className="h-5 w-5 text-[#D6B36A]" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[#D6B36A]">Started</p>
                        <p className="text-sm font-black text-[#FFF8E7]">
                          {formatDateTime(liveSession.started_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`${glassPanel} p-5`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D6B36A]/20 bg-[#1C0F08]">
                        <Sparkles className="h-5 w-5 text-[#D6B36A]" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[#D6B36A]">Status</p>
                        <p className="text-sm font-black capitalize text-[#FFF8E7]">{liveSession.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <section className={`${panel} p-5`}>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#D6B36A]">
                  Pastor
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-3xl border border-[#D6B36A]/25 bg-[#120A05]">
                    {liveSession.user_profiles?.avatar_url ? (
                      <img
                        src={liveSession.user_profiles.avatar_url}
                        alt={pastorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Church className="h-8 w-8 text-[#D6B36A]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-[#FFF8E7]">{pastorName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#E8D7B0]/55">
                      Leading Service
                    </p>
                  </div>
                </div>

                {isPastor && (
                  <button type="button" onClick={openPastorDashboard} className={`${goldButton} mt-5 w-full`}>
                    <ShieldCheck className="h-4 w-4" />
                    Manage Live Service
                  </button>
                )}
              </section>

              <section className={`${panel} p-5`}>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#D6B36A]">
                  Participate
                </p>

                <div className="mt-4 space-y-3">
                  <button type="button" onClick={openChurchWall} className={`${darkButton} w-full justify-start`}>
                    <MessageCircle className="h-4 w-4 text-[#D6B36A]" />
                    Open Church Wall
                  </button>

                  <button type="button" onClick={() => navigate('/church/prayer')} className={`${darkButton} w-full justify-start`}>
                    <HeartHandshake className="h-4 w-4 text-[#D6B36A]" />
                    Submit Prayer Request
                  </button>

                  <button type="button" onClick={() => navigate('/church')} className={`${darkButton} w-full justify-start`}>
                    <Home className="h-4 w-4 text-[#D6B36A]" />
                    Back to Church Home
                  </button>
                </div>
              </section>

              <section className={`${panel} p-5`}>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#D6B36A]">
                  Service Guide
                </p>

                <div className="mt-4 space-y-3 text-sm leading-6 text-[#E8D7B0]/78">
                  <p>• Join the audio room to listen live.</p>
                  <p>• Keep this page open while listening.</p>
                  <p>• Use the church wall for comments and community interaction.</p>
                  <p>• Submit prayer requests through the prayer page.</p>
                </div>
              </section>

              {sessionError && (
                <section className="rounded-3xl border border-yellow-300/25 bg-yellow-400/10 p-5 text-sm text-yellow-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>{sessionError}</p>
                  </div>
                </section>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}