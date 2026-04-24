import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Room, RoomEvent } from 'livekit-client';
import { 
  ArrowLeft, Gavel, Play, Pause, Video, VideoOff, Mic, MicOff,
  Clock, Users, Layers, Trophy, SkipForward,
  Maximize2, Minimize2
} from 'lucide-react';

interface AuctionLot {
  id: string;
  title: string;
  description: string;
  starting_bid: number;
  min_increment: number;
  current_highest_bid: number;
  current_highest_bidder_id: string;
  status: 'upcoming' | 'live' | 'sold' | 'unsold';
  countdown_end_at: string;
  order_index: number;
}

interface AuctionBid {
  id: string;
  bidder_id: string;
  bid_amount: number;
  created_at: string;
}

export default function AuctioneerDashboard() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [show, setShow] = useState<any>(null);
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!showId) return;

    try {
      const [showRes, lotsRes, bidsRes] = await Promise.all([
        supabase.from('auction_shows').select('*').eq('id', showId).single(),
        supabase.from('auction_lots').select('*').eq('auction_show_id', showId).order('order_index'),
        supabase.from('auction_bids').select('*').eq('auction_show_id', showId).order('created_at', { ascending: false }).limit(50)
      ]);

      if (showRes.data) setShow(showRes.data);
      if (lotsRes.data) setLots(lotsRes.data);
      if (bidsRes.data) setBids(bidsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (show?.status === 'live' && show?.livekit_room_name && user) {
      connectToLiveKit();
    }
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [show?.status, show?.livekit_room_name, user]);

  const connectToLiveKit = async () => {
    if (!show?.livekit_room_name || !user) return;

    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: show.livekit_room_name,
          identity: profile?.username || 'Auctioneer',
          role: 'publisher'
        }
      });

      if (tokenError) throw tokenError;

      if (!tokenData?.token) {
        console.error('No token returned:', tokenData);
        return;
      }

      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) {
        console.warn('LiveKit URL not configured');
        return;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

      await room.connect(livekitUrl, tokenData.token);
      roomRef.current = room;

      // Record presence
      await supabase
        .from('auction_presence')
        .upsert({
          auction_show_id: showId,
          user_id: user.id,
          presence_role: 'auctioneer',
          is_active: true,
          joined_at: new Date().toISOString()
        });

      // Show local video immediately
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        if (videoTrack && videoRef.current) {
          const videoEl = document.createElement('video');
          videoEl.srcObject = new MediaStream([videoTrack]);
          videoEl.autoplay = true;
          videoEl.playsInline = true;
          videoEl.muted = true;
          videoEl.className = 'w-full h-full object-cover rounded-lg';
          videoRef.current.innerHTML = '';
          videoRef.current.appendChild(videoEl);
        }
        
        const { createLocalVideoTrack, createLocalAudioTrack } = await import('livekit-client');
        
        if (videoTrack) {
          const localVideoTrack = await createLocalVideoTrack({ deviceId: videoTrack.getSettings().deviceId });
          await room.localParticipant.publishTrack(localVideoTrack);
        }
        
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          const localAudioTrack = await createLocalAudioTrack({ deviceId: audioTrack.getSettings().deviceId });
          await room.localParticipant.publishTrack(localAudioTrack);
        }
      } catch (err) {
        console.log('Camera/mic access failed:', err);
      }

    } catch (error) {
      console.error('Error connecting to LiveKit:', error);
    }
  };

  const handleTrackSubscribed = (publication: any, _participant: any, stream: any) => {
    if (videoRef.current && publication.kind === 'video') {
      const videoEl = document.createElement('video');
      videoEl.srcObject = new MediaStream([stream.getTracks()[0]]);
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.className = 'w-full h-full object-cover rounded-lg';
      videoRef.current.appendChild(videoEl);
    }
  };

  const startShow = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_auction_show', { p_show_id: showId });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Show is now live!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start show');
    } finally {
      setActionLoading(false);
    }
  };

  const endShow = async () => {
    if (!confirm('End this auction show?')) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('end_auction_show', { p_show_id: showId });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Show ended');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to end show');
    } finally {
      setActionLoading(false);
    }
  };

  const activateLot = async (lotId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('activate_auction_lot', {
        p_show_id: showId,
        p_lot_id: lotId,
        p_countdown_seconds: 30
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Lot is now live!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate lot');
    } finally {
      setActionLoading(false);
    }
  };

  const markSold = async (lotId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('mark_lot_sold', {
        p_show_id: showId,
        p_lot_id: lotId
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Lot marked as sold!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark sold');
    } finally {
      setActionLoading(false);
    }
  };

  const markUnsold = async (lotId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('mark_lot_unsold', {
        p_show_id: showId,
        p_lot_id: lotId
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Lot marked as unsold');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark unsold');
    } finally {
      setActionLoading(false);
    }
  };

  const currentLot = lots.find(l => l.status === 'live');
  const upcomingLots = lots.filter(l => l.status === 'upcoming');
  const soldLots = lots.filter(l => l.status === 'sold');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isLive = show?.status === 'live';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Header */}
      <div className={`p-4 border-b ${isLive ? 'bg-red-900/20 border-red-500/30' : 'bg-gray-900/50 border-gray-800'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/auctions/studio')} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                {isLive && <span className="px-2 py-0.5 bg-red-500 text-xs font-bold rounded animate-pulse">LIVE</span>}
                <h1 className="text-xl font-bold">{show?.title}</h1>
              </div>
              <p className="text-gray-400 text-sm">{isLive ? 'Broadcasting live' : 'Ready to start'}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!isLive ? (
              <button onClick={startShow} disabled={actionLoading || lots.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg">
                <Play className="w-4 h-4" /> Start Show
              </button>
            ) : (
              <button onClick={endShow} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 rounded-lg">
                <Pause className="w-4 h-4" /> End Show
              </button>
            )}
            <button onClick={() => navigate(`/auctions/${showId}`)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg">
              <Users className="w-4 h-4" /> View as Viewer
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Video Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Live Video */}
          <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden border border-green-500/30">
            <div ref={videoRef} className="absolute inset-0">
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Video className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-green-400 text-lg font-bold">Live Broadcast</p>
                  <p className="text-gray-500 text-sm">Screen share or camera feed</p>
                </div>
              </div>
            </div>
            
            {isLive && (
              <>
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button onClick={() => setIsVideoOn(!isVideoOn)} className="p-2 bg-black/70 rounded-lg hover:bg-black/50">
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setIsAudioOn(!isAudioOn)} className="p-2 bg-black/70 rounded-lg hover:bg-black/50">
                    {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-black/70 rounded-lg hover:bg-black/50">
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Current Lot */}
          {currentLot ? (
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/20 border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-green-400 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Currently Live - Lot #{lots.indexOf(currentLot) + 1}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => markSold(currentLot.id)} disabled={actionLoading} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm">
                    Mark Sold
                  </button>
                  <button onClick={() => markUnsold(currentLot.id)} disabled={actionLoading} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                    Mark Unsold
                  </button>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">{currentLot.title}</h2>
              {currentLot.description && <p className="text-gray-400 mb-4">{currentLot.description}</p>}
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Starting Bid</p>
                  <p className="text-lg font-bold">{currentLot.starting_bid.toLocaleString()} TC</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Min Increment</p>
                  <p className="text-lg font-bold">{currentLot.min_increment.toLocaleString()} TC</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Current Bid</p>
                  <p className="text-lg font-bold text-green-400">{(currentLot.current_highest_bid || currentLot.starting_bid).toLocaleString()} TC</p>
                </div>
              </div>

              {currentLot.countdown_end_at && (
                <p className="text-gray-400 text-sm"><Clock className="w-4 h-4 inline" /> Next lot in: {new Date(currentLot.countdown_end_at).toLocaleTimeString()}</p>
              )}
            </div>
          ) : (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
              <Gavel className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{isLive ? 'No lot currently active' : 'Start the show and activate a lot to begin'}</p>
            </div>
          )}

          {/* Upcoming */}
          {upcomingLots.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Layers className="w-5 h-5" /> Queue ({upcomingLots.length})</h3>
              <div className="space-y-2">
                {upcomingLots.map((lot, idx) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-sm">{idx + 1}</span>
                      <div>
                        <p className="font-medium">{lot.title}</p>
                        <p className="text-gray-500 text-sm">Starting: {lot.starting_bid.toLocaleString()} TC</p>
                      </div>
                    </div>
                    {isLive && (
                      <button onClick={() => activateLot(lot.id)} disabled={actionLoading} className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm">
                        <SkipForward className="w-4 h-4" /> Go Live
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h3 className="font-bold mb-3">Statistics</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">Total Lots</span><span>{lots.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Sold</span><span className="text-green-400">{soldLots.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Bids</span><span>{bids.length}</span></div>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h3 className="font-bold mb-3">Recent Bids</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bids.slice(0, 10).map((bid) => (
                <div key={bid.id} className="flex justify-between text-sm p-2 bg-black/30 rounded">
                  <span className="text-gray-400">#{bid.id.slice(-4)}</span>
                  <span className="text-yellow-400 font-medium">{bid.bid_amount.toLocaleString()} TC</span>
                </div>
              ))}
              {bids.length === 0 && <p className="text-gray-500 text-sm">No bids yet</p>}
            </div>
          </div>

          {soldLots.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Winners</h3>
              <div className="space-y-2">
                {soldLots.map((lot) => (
                  <div key={lot.id} className="p-2 bg-black/30 rounded">
                    <p className="text-sm font-medium truncate">{lot.title}</p>
                    <p className="text-green-400 text-sm">{lot.current_highest_bid?.toLocaleString()} TC</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}