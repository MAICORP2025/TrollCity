import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalTracks,
  VideoPresets,
  AudioPresets,
} from 'livekit-client';
import {
  ArrowLeft,
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  Coins,
  Flag,
  Gavel,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Shield,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import LiveKitViewerPlayer from '../../components/broadcast/LiveKitViewerPlayer';

type AuctionShowStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';
type AuctionLotStatus = 'upcoming' | 'live' | 'sold' | 'unsold' | 'cancelled';

interface AuctionShow {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
  status: AuctionShowStatus;
  scheduled_for?: string | null;
  live_started_at?: string | null;
  ended_at?: string | null;
  livekit_room_name?: string | null;
  auctioneer_id: string;
  current_lot_id?: string | null;

  hls_url?: string | null;
  egress_id?: string | null;
}

interface AuctionLot {
  id: string;
  auction_show_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  starting_bid: number;
  bid_increment: number;
  current_highest_bid?: number | null;
  current_highest_bidder_id?: string | null;
  status: AuctionLotStatus;
  countdown_end_at?: string | null;
  order_index?: number | null;
  reserve_price?: number | null;
  buy_now_price?: number | null;
  condition?: string | null;
  quantity?: number | null;
}

interface AuctionBid {
  id: string;
  lot_id?: string | null;
  bidder_id: string;
  bid_amount: number;
  created_at: string;
  bidder?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface UserProfile {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  troll_coins: number;
  role?: string | null;
  is_admin?: boolean | null;
  is_superadmin?: boolean | null;
}

interface LiveAuctionStateRpc {
  current_lot?: AuctionLot | null;
  recent_bids?: AuctionBid[];
  viewer_count?: number;
}

interface PlaceBidResult {
  accepted?: boolean;
  reason?: string;
  bid_id?: string;
  new_highest_bid?: number;
}

const MIN_COINS_TO_BID = 100;

function formatCoins(value?: number | null) {
  return Number(value || 0).toLocaleString();
}

function getDisplayName(profile?: UserProfile | null) {
  return profile?.username || profile?.display_name || 'Troll Citizen';
}

export default function LiveAuctionRoom() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [show, setShow] = useState<AuctionShow | null>(null);
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [currentLot, setCurrentLot] = useState<AuctionLot | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'bids' | 'info' | 'lot'>('bids');

  const [bidAmount, setBidAmount] = useState('');
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bidError, setBidError] = useState('');

  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [auctioneerMicOn, setAuctioneerMicOn] = useState(true);
  const [auctioneerCamOn, setAuctioneerCamOn] = useState(true);
  const [auctioneerConnecting, setAuctioneerConnecting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const liveKitConnectedRef = useRef(false);
  const viewerRoomRef = useRef<Room | null>(null);

  const presenceKey = user?.id || `anon-auction-${showId || 'unknown'}`;

  const isAuctioneer = useMemo(() => {
    if (!user?.id || !show) return false;
    return show.auctioneer_id === user.id;
  }, [show, user?.id]);

  const minimumBid = useMemo(() => {
    if (!currentLot) return 0;
    const current = Number(currentLot.current_highest_bid || 0);
    return current > 0
      ? current + Number(currentLot.bid_increment || 100)
      : Number(currentLot.starting_bid || 0);
  }, [currentLot]);

  const canBid = !!user && !!currentLot && currentLot.status === 'live' && Number(userProfile?.troll_coins || 0) >= MIN_COINS_TO_BID;

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, troll_coins, role, is_admin, is_superadmin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[LiveAuctionRoom] Failed to fetch user profile:', error);
      return;
    }

    if (data) {
      setUserProfile({
        ...data,
        troll_coins: Number(data.troll_coins || 0),
      });
    }
  }, [user?.id]);

  const fetchLots = useCallback(async (auctionShowId: string) => {
    const { data, error } = await supabase
      .from('auction_lots')
      .select(`
        id,
        auction_show_id,
        title,
        description,
        image_url,
        starting_bid,
        bid_increment,
        current_highest_bid,
        current_highest_bidder_id,
        status,
        countdown_end_at,
        order_index,
        reserve_price,
        buy_now_price,
        condition,
        quantity
      `)
      .eq('auction_show_id', auctionShowId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[LiveAuctionRoom] Failed to fetch lots:', error);
      return;
    }

    setLots((data || []) as AuctionLot[]);
  }, []);

  const fetchLiveState = useCallback(async () => {
    if (!showId) return;

    try {
      const { data, error } = await supabase.rpc('get_live_auction_state', {
        p_show_id: showId,
      });

      if (error) throw error;

      const state = data as LiveAuctionStateRpc | null;

      if (state?.current_lot) setCurrentLot(state.current_lot);
      if (Array.isArray(state?.recent_bids)) setBids(state.recent_bids);
      if (typeof state?.viewer_count === 'number') setViewerCount(state.viewer_count);
    } catch (error) {
      console.warn('[LiveAuctionRoom] get_live_auction_state failed:', error);
    }
  }, [showId]);

  const fetchShow = useCallback(async () => {
    if (!showId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('auction_shows')
        .select(`
          id,
          title,
          description,
          category,
          thumbnail_url,
          status,
          scheduled_for,
          live_started_at,
          ended_at,
          livekit_room_name,
          auctioneer_id,
          current_lot_id,
          hls_url,
          egress_id
        `)
        .eq('id', showId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setShow(null);
        toast.error('Auction not found');
        return;
      }

      const nextShow = data as AuctionShow;
      setShow(nextShow);

      if (nextShow.status !== 'live') {
        toast.error('This auction is not currently live');
        navigate('/auctions');
        return;
      }

      await Promise.all([
        fetchLots(nextShow.id),
        fetchLiveState(),
        fetchUserProfile(),
      ]);
    } catch (error) {
      console.error('[LiveAuctionRoom] Error fetching show:', error);
      toast.error('Failed to load auction room');
    } finally {
      setLoading(false);
    }
  }, [fetchLiveState, fetchLots, fetchUserProfile, navigate, showId]);

  const markPresenceInactive = useCallback(async () => {
    if (!showId || !user?.id) return;

    await supabase
      .from('auction_presence')
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq('auction_show_id', showId)
      .eq('user_id', user.id);
  }, [showId, user?.id]);

  const trackPresence = useCallback(async () => {
    if (!showId || !user?.id) return;

    await supabase
      .from('auction_presence')
      .upsert(
        {
          auction_show_id: showId,
          user_id: user.id,
          presence_role: isAuctioneer ? 'auctioneer' : 'bidder',
          is_active: true,
          joined_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        },
        {
          onConflict: 'auction_show_id,user_id',
        }
      );
  }, [isAuctioneer, showId, user?.id]);

  const connectViewerLiveKit = useCallback(async () => {
    if (!show || !user?.id || isAuctioneer) return;
    if (liveKitConnectedRef.current || roomRef.current) return;

    const roomName = show.livekit_room_name || show.id;
    if (!roomName) return;

    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;

    if (!livekitUrl) {
      toast.error('LiveKit URL is not configured');
      return;
    }

    try {
      const viewerIdentity = `viewer-${user.id}-${Date.now()}`;

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          identity: viewerIdentity,
          name: profile?.username || user.email || 'Viewer',
          role: 'audience',
          isHost: false,
        },
      });

      if (error) throw error;
      if (!data?.token) throw new Error('No LiveKit token returned');

      const room = new Room();
      viewerRoomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        liveKitConnectedRef.current = false;
        viewerRoomRef.current = null;
      });

      await room.connect(livekitUrl, data.token);
      liveKitConnectedRef.current = true;
    } catch (error: any) {
      console.error('[LiveAuctionRoom] Viewer LiveKit connection failed:', error);
      toast.error(error?.message || 'Failed to connect to auction stream');
      if (viewerRoomRef.current) {
        try { await viewerRoomRef.current.disconnect(); } catch {}
        viewerRoomRef.current = null;
      }
      liveKitConnectedRef.current = false;
    }
  }, [cleanupLiveKit, isAuctioneer, profile?.username, show, user?.email, user?.id]);

  const cleanupLiveKit = useCallback(async () => {
    const room = roomRef.current;

    try {
      audioTrackRef.current?.stop();
      videoTrackRef.current?.stop();

      audioTrackRef.current = null;
      videoTrackRef.current = null;

      if (room) {
        room.off(RoomEvent.Disconnected, () => {});
        await room.disconnect();
      }
    } catch (error) {
      console.warn('[LiveAuctionRoom] LiveKit cleanup error:', error);
    } finally {
      roomRef.current = null;
      // Also disconnect viewer room
      if (viewerRoomRef.current) {
        try { await viewerRoomRef.current.disconnect(); } catch {}
        viewerRoomRef.current = null;
      }
      liveKitConnectedRef.current = false;
    }
  }, []);

  const connectAuctioneerLiveKit = useCallback(async () => {
    if (!show || !showId || !user?.id || !isAuctioneer) return;
    if (liveKitConnectedRef.current || roomRef.current) return;

    const roomName = show.livekit_room_name || show.id;
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;

    if (!livekitUrl) {
      toast.error('LiveKit URL is not configured');
      return;
    }

    setAuctioneerConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          identity: user.id,
          name: profile?.username || user.email || 'Auctioneer',
          role: 'publisher',
          isHost: true,
        },
      });

      if (error) throw error;
      if (!data?.token) throw new Error('No LiveKit token returned');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        liveKitConnectedRef.current = false;
        roomRef.current = null;
      });

      await room.connect(livekitUrl, data.token);

      const tracks = await createLocalTracks({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: 'user',
          resolution: VideoPresets.h720.resolution,
        },
      });

      const audioTrack = tracks.find((track) => track.kind === 'audio') as LocalAudioTrack | undefined;
      const videoTrack = tracks.find((track) => track.kind === 'video') as LocalVideoTrack | undefined;

      if (audioTrack) {
        audioTrackRef.current = audioTrack;
        await room.localParticipant.publishTrack(audioTrack, AudioPresets.music);
      }

      if (videoTrack) {
        videoTrackRef.current = videoTrack;
        await room.localParticipant.publishTrack(videoTrack);
      }

      liveKitConnectedRef.current = true;
      toast.success('Auctioneer camera connected');
    } catch (error: any) {
      console.error('[LiveAuctionRoom] Auctioneer LiveKit connection failed:', error);
      toast.error(error?.message || 'Failed to connect auctioneer camera');
      await cleanupLiveKit();
    } finally {
      setAuctioneerConnecting(false);
    }
  }, [cleanupLiveKit, isAuctioneer, profile?.username, show, showId, user?.email, user?.id]);

  const toggleAuctioneerMic = useCallback(async () => {
    const track = audioTrackRef.current;
    if (!track) return;

    if (auctioneerMicOn) {
      await track.mute();
      setAuctioneerMicOn(false);
    } else {
      await track.unmute();
      setAuctioneerMicOn(true);
    }
  }, [auctioneerMicOn]);

  const toggleAuctioneerCam = useCallback(async () => {
    const track = videoTrackRef.current;
    if (!track) return;

    if (auctioneerCamOn) {
      await track.mute();
      setAuctioneerCamOn(false);
    } else {
      await track.unmute();
      setAuctioneerCamOn(true);
    }
  }, [auctioneerCamOn]);

  const placeBid = useCallback(async () => {
    if (!showId || !currentLot || !user?.id) {
      toast.error('You must be logged in to bid');
      return;
    }

    const bidValue = Number.parseInt(bidAmount, 10);

    if (!Number.isFinite(bidValue) || bidValue <= 0) {
      setBidStatus('error');
      setBidError('Enter a valid bid amount');
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if (currentLot.status !== 'live') {
      setBidStatus('error');
      setBidError('This lot is not accepting bids');
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if (bidValue < minimumBid) {
      setBidStatus('error');
      setBidError(`Minimum bid is ${formatCoins(minimumBid)} coins`);
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if (Number(userProfile?.troll_coins || 0) < MIN_COINS_TO_BID) {
      setBidStatus('error');
      setBidError(`Minimum ${formatCoins(MIN_COINS_TO_BID)} coins required to bid`);
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('place_bid', {
        p_show_id: showId,
        p_lot_id: currentLot.id,
        p_bid_amount: bidValue,
      });

      if (error) throw error;

      const result = data as PlaceBidResult;

      if (result && result.accepted === false) {
        setBidStatus('error');
        setBidError(result.reason || 'Bid failed');
        window.setTimeout(() => setBidStatus('idle'), 3000);
        return;
      }

      setBidStatus('success');
      setBidAmount('');
      await Promise.all([fetchLiveState(), fetchUserProfile()]);
      window.setTimeout(() => setBidStatus('idle'), 2000);
    } catch (error: any) {
      console.error('[LiveAuctionRoom] Bid failed:', error);
      setBidStatus('error');
      setBidError(error?.message || 'Failed to place bid');
      window.setTimeout(() => setBidStatus('idle'), 3000);
    }
  }, [bidAmount, currentLot, fetchLiveState, fetchUserProfile, minimumBid, showId, user?.id, userProfile?.troll_coins]);

  const quickBid = useCallback((extra: number) => {
    setBidAmount(String(minimumBid + extra));
  }, [minimumBid]);

  const formatCountdown = useCallback((countdownEnd?: string | null) => {
    if (!countdownEnd) return '0:00';

    const diff = Math.max(0, new Date(countdownEnd).getTime() - Date.now());
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  const handleFullscreen = useCallback(async () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    fetchShow();
  }, [fetchShow]);

  useEffect(() => {
    if (!showId) return;

    const channel = supabase
      .channel(`auction-room:${showId}`, {
        config: {
          presence: {
            key: presenceKey,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_lots',
          filter: `auction_show_id=eq.${showId}`,
        },
        async () => {
          await Promise.all([fetchLots(showId), fetchLiveState()]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_bids',
        },
        async () => {
          await fetchLiveState();
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let count = 0;

        Object.values(state).forEach((items) => {
          count += Array.isArray(items) ? items.length : 0;
        });

        setViewerCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user?.id || presenceKey,
            username: profile?.username || user?.email || 'Guest Bidder',
            role: isAuctioneer ? 'auctioneer' : 'bidder',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [fetchLiveState, fetchLots, isAuctioneer, presenceKey, profile?.username, showId, user?.email, user?.id]);

  useEffect(() => {
    trackPresence();

    const interval = window.setInterval(() => {
      trackPresence();
    }, 30000);

    return () => {
      window.clearInterval(interval);
      markPresenceInactive();
    };
  }, [markPresenceInactive, trackPresence]);

  useEffect(() => {
    if (!isAuctioneer) {
      connectViewerLiveKit();
    }

    return () => {
      cleanupLiveKit();
    };
  }, [cleanupLiveKit, connectViewerLiveKit, isAuctioneer]);

  const upcomingLots = lots.filter((lot) => lot.status === 'upcoming');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#02030a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-300 animate-spin mx-auto" />
          <p className="text-slate-400 mt-4">Loading auction room...</p>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-[#02030a] text-white flex items-center justify-center">
        <div className="text-center">
          <Gavel className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Auction not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02030a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(8,13,30,0.98))]" />
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative z-10 border-b border-cyan-400/20 bg-black/45 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/auctions')}
              className="p-2 rounded-xl border border-cyan-400/20 bg-white/5 hover:bg-cyan-400/10 transition"
            >
              <ArrowLeft className="w-5 h-5 text-cyan-300" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-md bg-red-500 text-xs font-black tracking-wide animate-pulse">
                  LIVE AUCTION
                </span>
                <span className="text-cyan-300 text-sm font-bold flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {viewerCount} watching
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black">{show.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl border border-cyan-400/20 bg-white/5 hover:bg-cyan-400/10 transition">
              <Bell className="w-5 h-5 text-cyan-200" />
            </button>
            <button className="p-2 rounded-xl border border-purple-400/20 bg-white/5 hover:bg-purple-400/10 transition">
              <Shield className="w-5 h-5 text-purple-200" />
            </button>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-cyan-400/25 bg-black shadow-[0_0_45px_rgba(34,211,238,0.16)]">
            {isAuctioneer ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/25 to-purple-950/25">
                 <Gavel className="w-16 h-16 text-cyan-300 animate-pulse" />
                 <p className="mt-4 text-xl font-black text-cyan-100">Auctioneer LiveKit Control Room</p>
                 <p className="text-sm text-slate-400 mt-1">
                   Your camera is sent through LiveKit and distributed to bidders through LiveKit.
                 </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={connectAuctioneerLiveKit}
                    disabled={auctioneerConnecting || liveKitConnectedRef.current}
                    className="px-4 py-3 rounded-xl bg-cyan-500/20 border border-cyan-300/30 text-cyan-100 font-bold hover:bg-cyan-500/30 disabled:opacity-50"
                  >
                    {auctioneerConnecting ? 'Connecting...' : liveKitConnectedRef.current ? 'Camera Connected' : 'Connect Camera'}
                  </button>

                  <button
                    onClick={toggleAuctioneerMic}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-2"
                  >
                    {auctioneerMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    {auctioneerMicOn ? 'Mic On' : 'Mic Off'}
                  </button>

                  <button
                    onClick={toggleAuctioneerCam}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-2"
                  >
                    {auctioneerCamOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    {auctioneerCamOn ? 'Camera On' : 'Camera Off'}
                  </button>
                </div>
              </div>
             ) : show?.hls_url || show?.livekit_room_name ? (
              <>
                {show?.hls_url ? (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover bg-black"
                    controls={false}
                    muted={isMuted}
                    playsInline
                    autoPlay
                  />
                ) : show ? (
                  <LiveKitViewerPlayer
                    streamId={show.id}
                    broadcasterId={show.auctioneer_id}
                    roomName={show.livekit_room_name || show.id}
                  />
                ) : null}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/20 to-purple-950/20">
                <Gavel className="w-16 h-16 text-cyan-300 animate-pulse" />
                <p className="mt-4 text-xl font-black text-cyan-100">Waiting for LiveKit stream</p>
                <p className="text-sm text-slate-400 mt-1">No `hls_url` or `livekit_room_name` configured on this auction show.</p>
              </div>
            )}

            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-sm font-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-black/70 border border-cyan-300/20 text-cyan-100 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                {viewerCount}
              </span>
            </div>

            {currentLot?.countdown_end_at && (
              <div className="absolute bottom-4 left-4">
                <div
                  className={`px-4 py-2 rounded-2xl border text-2xl font-black font-mono ${
                    new Date(currentLot.countdown_end_at).getTime() - Date.now() < 10000
                      ? 'bg-red-500 text-white border-red-300 animate-pulse'
                      : 'bg-black/75 text-cyan-200 border-cyan-300/25'
                  }`}
                >
                  <Clock className="w-5 h-5 inline mr-2" />
                  {formatCountdown(currentLot.countdown_end_at)}
                </div>
              </div>
            )}

            {!isAuctioneer && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="p-3 rounded-xl bg-black/70 border border-white/10 hover:bg-black/50"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleFullscreen}
                  className="p-3 rounded-xl bg-black/70 border border-white/10 hover:bg-black/50"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {currentLot ? (
            <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] backdrop-blur-xl p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-cyan-300 text-xs font-black uppercase tracking-[0.22em]">Current Lot</p>
                  <h2 className="text-2xl font-black mt-1">{currentLot.title}</h2>
                  {currentLot.description && (
                    <p className="text-slate-300 text-sm mt-2 line-clamp-3">{currentLot.description}</p>
                  )}
                </div>
                <span className="px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-300/30 text-cyan-200 text-xs font-bold">
                  {currentLot.status.toUpperCase()}
                </span>
              </div>

              {currentLot.image_url && (
                <img
                  src={currentLot.image_url}
                  alt={currentLot.title}
                  className="mb-4 h-56 w-full object-cover rounded-2xl border border-white/10"
                />
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-2xl bg-black/35 border border-white/10 p-3">
                  <p className="text-slate-500 text-xs">Starting Bid</p>
                  <p className="text-white font-black">{formatCoins(currentLot.starting_bid)} TC</p>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/10 p-3">
                  <p className="text-slate-500 text-xs">Bid Increment</p>
                  <p className="text-white font-black">{formatCoins(currentLot.bid_increment)} TC</p>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/10 p-3">
                  <p className="text-slate-500 text-xs">Reserve</p>
                  <p className="text-white font-black">{currentLot.reserve_price ? `${formatCoins(currentLot.reserve_price)} TC` : 'None'}</p>
                </div>
                <div className="rounded-2xl bg-black/35 border border-white/10 p-3">
                  <p className="text-slate-500 text-xs">Quantity</p>
                  <p className="text-white font-black">{currentLot.quantity || 1}</p>
                </div>
              </div>

              <div className="rounded-3xl p-5 text-center border border-yellow-300/30 bg-gradient-to-r from-yellow-500/15 via-cyan-500/10 to-purple-500/15">
                <p className="text-cyan-200 text-sm font-bold">Current Highest Bid</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Coins className="w-9 h-9 text-yellow-300" />
                  <span className="text-5xl font-black">{formatCoins(currentLot.current_highest_bid || currentLot.starting_bid)}</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">Next minimum bid: {formatCoins(minimumBid)} coins</p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <Gavel className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No lot currently active</p>
            </div>
          )}

          {currentLot?.status === 'live' && !isAuctioneer && (
            <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] backdrop-blur-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Coins className="w-6 h-6 text-yellow-300" />
                  <span className="font-bold">Your Balance: {formatCoins(userProfile?.troll_coins)} coins</span>
                </div>

                {canBid ? (
                  <span className="flex items-center gap-1 text-cyan-300 text-sm font-bold">
                    <CheckCircle className="w-4 h-4" /> Eligible to bid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-300 text-sm font-bold">
                    <XCircle className="w-4 h-4" /> Need {formatCoins(MIN_COINS_TO_BID)}+ coins
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => quickBid(amount)}
                    className="py-3 rounded-2xl bg-black/35 border border-cyan-400/15 hover:bg-cyan-400/10 font-black"
                  >
                    +{formatCoins(amount)}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={`Min: ${formatCoins(minimumBid)}`}
                    className="w-full py-4 px-4 pr-16 rounded-2xl bg-black/45 border border-cyan-400/20 text-white text-lg outline-none focus:border-cyan-300"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">coins</span>
                </div>
                <button
                  onClick={placeBid}
                  disabled={!bidAmount || !canBid}
                  className="px-6 sm:px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 font-black shadow-[0_0_25px_rgba(34,211,238,0.25)]"
                >
                  Place Bid
                </button>
              </div>

              {bidStatus === 'success' && (
                <div className="mt-3 p-3 rounded-2xl bg-cyan-400/10 border border-cyan-300/30 flex items-center gap-2 text-cyan-200">
                  <CheckCircle className="w-5 h-5" />
                  Bid accepted!
                </div>
              )}

              {bidStatus === 'error' && (
                <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-center gap-2 text-red-200">
                  <AlertCircle className="w-5 h-5" />
                  {bidError}
                </div>
              )}
            </div>
          )}

          {upcomingLots.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-black mb-3">Upcoming Lots</h3>
              <div className="space-y-2">
                {upcomingLots.map((lot, index) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-cyan-400/10 border border-cyan-300/20 text-cyan-200 flex items-center justify-center text-sm font-black">
                        {index + 1}
                      </span>
                      <span className="font-bold">{lot.title}</span>
                    </div>
                    <span className="text-yellow-300 text-sm font-bold">Starting: {formatCoins(lot.starting_bid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] backdrop-blur-xl p-5">
            <h3 className="text-lg font-black mb-3">Auction Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-xs">Show Title</p>
                <p className="font-bold">{show.title}</p>
              </div>
              {show.category && (
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <Gavel className="w-4 h-4 text-cyan-300" />
                  <span>{show.category}</span>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs">Video Route</p>
                <p className="text-sm text-cyan-200 font-bold">
                  {isAuctioneer ? 'LiveKit Publisher' : show?.hls_url ? 'HLS Viewer' : show?.livekit_room_name ? 'LiveKit Viewer' : 'Waiting for stream'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden">
            <div className="flex border-b border-white/10">
              {(['bids', 'info', 'lot'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`flex-1 py-3 text-sm font-black capitalize ${
                    selectedTab === tab
                      ? 'text-cyan-200 bg-cyan-400/10 border-b-2 border-cyan-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'lot' ? 'Lots' : tab}
                </button>
              ))}
            </div>

            {selectedTab === 'bids' && (
              <div className="p-3 max-h-96 overflow-y-auto space-y-2">
                {bids.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">No bids yet</p>
                ) : (
                  bids.map((bid) => {
                    const name = bid.bidder?.username || bid.bidder?.display_name || 'Anonymous';
                    return (
                      <div key={bid.id} className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center font-black">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{name}</p>
                            <p className="text-slate-500 text-xs">{new Date(bid.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <span className="text-yellow-300 font-black">{formatCoins(bid.bid_amount)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {selectedTab === 'info' && (
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-slate-500 text-xs">Current Lot</p>
                  <p className="font-bold">{currentLot?.title || 'None'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Minimum Increment</p>
                  <p className="font-bold">{formatCoins(currentLot?.bid_increment)} coins</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Total Lots</p>
                  <p className="font-bold">{lots.length}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Logged In As</p>
                  <p className="font-bold">{getDisplayName(userProfile)}</p>
                </div>
              </div>
            )}

            {selectedTab === 'lot' && (
              <div className="p-3 max-h-96 overflow-y-auto space-y-2">
                {lots.map((lot, index) => (
                  <div
                    key={lot.id}
                    className={`p-3 rounded-2xl border ${
                      lot.id === currentLot?.id
                        ? 'bg-cyan-400/10 border-cyan-300/30'
                        : 'bg-black/30 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black">
                        {index + 1}
                      </span>
                      <span className={`text-sm font-bold ${lot.id === currentLot?.id ? 'text-cyan-200' : 'text-white'}`}>
                        {lot.title}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs ml-8 mt-1">
                      {lot.status === 'sold'
                        ? `Sold: ${formatCoins(lot.current_highest_bid)}`
                        : lot.status === 'live'
                          ? `Current: ${formatCoins(lot.current_highest_bid || lot.starting_bid)}`
                          : `Starting: ${formatCoins(lot.starting_bid)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => toast.info('Report feature coming soon')}
            className="w-full py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-200 text-sm font-black transition flex items-center justify-center gap-2"
          >
            <Flag className="w-4 h-4" />
            Report Issue
          </button>
        </aside>
      </main>
    </div>
  );
}