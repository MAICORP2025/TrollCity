import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';
import { 
  ArrowLeft, Gavel, Users, Clock, Coins, AlertCircle, 
  CheckCircle, XCircle, Bell, Shield, Volume2, VolumeX,
  Maximize2, Minimize2, Flag
} from 'lucide-react';

interface AuctionShow {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduled_for: string;
  live_started_at: string;
  ended_at: string;
  livekit_room_name: string;
  auctioneer_id: string;
  current_lot_id: string;
  auctioneer?: {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface AuctionLot {
  id: string;
  title: string;
  description: string;
  image_urls: string[];
  starting_bid: number;
  min_increment: number;
  current_highest_bid: number;
  current_highest_bidder_id: string;
  status: 'upcoming' | 'live' | 'sold' | 'unsold';
  countdown_end_at: string;
}

interface AuctionBid {
  id: string;
  bidder_id: string;
  bid_amount: number;
  created_at: string;
  bidder?: {
    username: string;
    avatar_url: string;
  };
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  troll_coins: number;
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
  
  const [bidAmount, setBidAmount] = useState('');
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bidError, setBidError] = useState('');
  const [selectedTab, setSelectedTab] = useState<'bids' | 'info' | 'lot'>('bids');
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const fetchShow = useCallback(async () => {
    try {
      const { data: showData, error: showError } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('id', showId)
        .single();

      if (showError) throw showError;
      setShow(showData);

      if (showData.status !== 'live') {
        toast.error('This auction is not currently live');
        navigate('/auctions');
        return;
      }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (profileData) {
        setUserProfile({ ...profileData, troll_coins: profileData.troll_coins || 0 });
      }

      fetchLots(showData.id);
      fetchLiveState();
    } catch (error) {
      console.error('Error fetching show:', error);
    } finally {
      setLoading(false);
    }
  }, [showId, user, navigate]);

  const fetchLots = useCallback(async (showId: string) => {
    const { data } = await supabase
      .from('auction_lots')
      .select('*')
      .eq('auction_show_id', showId)
      .order('order_index');
    
    if (data) setLots(data);
  }, [showId]);

  const fetchLiveState = useCallback(async () => {
    if (!showId) return;

    try {
      const { data } = await supabase.rpc('get_live_auction_state', {
        p_show_id: showId
      });

      if (data) {
        if (data.current_lot) {
          setCurrentLot(data.current_lot);
        }
        if (data.recent_bids) {
          setBids(data.recent_bids);
        }
        if (data.viewer_count) {
          setViewerCount(data.viewer_count);
        }
      }

      const { count } = await supabase
        .from('auction_presence')
        .select('*', { count: 'exact', head: true })
        .eq('auction_show_id', showId)
        .eq('is_active', true);
      
      if (count) setViewerCount(count);
    } catch (_error) {
      console.error('Error fetching live state:', _error);
    }
  }, [showId]);

  const connectToLiveKit = useCallback(async () => {
    if (!showId || !user) return;

    let roomName = show?.livekit_room_name;
    if (!roomName) {
      const { data: showData } = await supabase
        .from('auction_shows')
        .select('livekit_room_name')
        .eq('id', showId)
        .single();
      
      if (!showData?.livekit_room_name) {
        console.warn('No LiveKit room name for this show');
        return;
      }
      
      roomName = showData.livekit_room_name;
      setShow(prev => ({ ...prev, livekit_room_name: roomName }));
    }

    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          identity: profile?.username || 'Viewer',
          role: 'viewer'
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

      room.on(RoomEvent.ParticipantJoined, handleParticipantJoined);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

      await room.connect(livekitUrl, tokenData.token);
      roomRef.current = room;

      await supabase
        .from('auction_presence')
        .upsert({
          auction_show_id: showId,
          user_id: user.id,
          presence_role: 'viewer',
          is_active: true,
          joined_at: new Date().toISOString()
        });

    } catch (_error) {
      console.error('Error connecting to LiveKit:', _error);
    }
  }, [showId, show?.livekit_room_name, user, profile]);

  const handleParticipantJoined = useCallback((participant: RemoteParticipant) => {
    console.log('Participant joined:', participant.identity);
  }, []);

  const handleTrackSubscribed = useCallback((publication: any, _participant: RemoteParticipant, stream: any) => {
    if (videoRef.current && publication.kind === 'video') {
      const videoEl = document.createElement('video');
      videoEl.srcObject = new MediaStream([stream.getTracks()[0]]);
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.className = 'w-full h-full object-cover';
      videoRef.current.appendChild(videoEl);
    }
  }, []);

  useEffect(() => {
    if (showId) {
      fetchShow();
      const interval = setInterval(fetchLiveState, 3000);
      return () => clearInterval(interval);
    }
  }, [showId, fetchShow, fetchLiveState]);

  useEffect(() => {
    if (show?.livekit_room_name && user) {
      connectToLiveKit();
      return () => {
        if (roomRef.current) {
          roomRef.current.disconnect();
        }
      };
    }
  }, [show?.livekit_room_name, user, profile, connectToLiveKit]);

  const placeBid = async () => {
    if (!bidAmount || !currentLot || !user) return;

    const bidValue = parseInt(bidAmount);
    const minBid = currentLot.current_highest_bid 
      ? currentLot.current_highest_bid + currentLot.min_increment 
      : currentLot.starting_bid;

    if (bidValue < minBid) {
      setBidStatus('error');
      setBidError(`Minimum bid is ${minBid.toLocaleString()} coins`);
      setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if ((userProfile?.troll_coins || 0) < 5000) {
      setBidStatus('error');
      setBidError('Minimum 5,000 coins required to bid');
      setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('place_bid', {
        p_show_id: showId,
        p_lot_id: currentLot.id,
        p_bid_amount: bidValue
      });

      if (error) throw error;

      const result = data as any;
      if (!result.accepted) {
        setBidStatus('error');
        setBidError(result.reason || 'Bid failed');
        setTimeout(() => setBidStatus('idle'), 3000);
        return;
      }

      setBidStatus('success');
      setBidAmount('');
      fetchLiveState();
      setTimeout(() => setBidStatus('idle'), 2000);
    } catch (error: any) {
      setBidStatus('error');
      setBidError(error.message || 'Failed to place bid');
      setTimeout(() => setBidStatus('idle'), 3000);
    }
  };

  const quickBid = (increment: number) => {
    if (!currentLot) return;
    const minBid = currentLot.current_highest_bid 
      ? currentLot.current_highest_bid + currentLot.min_increment 
      : currentLot.starting_bid;
    setBidAmount((minBid + increment).toString());
  };

  const formatTime = (countdownEnd: string) => {
    const end = new Date(countdownEnd).getTime();
    const diff = Math.max(0, end - Date.now());
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const minBid = currentLot ? (currentLot.current_highest_bid 
    ? currentLot.current_highest_bid + currentLot.min_increment 
    : currentLot.starting_bid) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Gavel className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Auction not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900/80 to-emerald-900/80 border-b border-green-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/auctions')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-green-400" />
              </button>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                  LIVE
                </div>
                <span className="text-green-400 font-bold">{viewerCount} watching</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Shield className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Live Video Area */}
          <div 
            ref={videoRef}
            className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden border border-green-500/30"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Gavel className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
                <p className="text-green-400 text-lg font-bold">Live Auction Stream</p>
                <p className="text-gray-500 text-sm">Auctioneer camera feed</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg flex items-center gap-2">
                <Users className="w-4 h-4" />
                {viewerCount}
              </div>
            </div>
            {currentLot?.countdown_end_at && (
              <div className="absolute bottom-4 left-4">
                <div className={`px-4 py-2 rounded-lg text-2xl font-bold font-mono ${
                  new Date(currentLot.countdown_end_at).getTime() - Date.now() < 10000 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-black/70 text-green-400'
                }`}>
                  <Clock className="w-5 h-5 inline mr-2" />
                  {formatTime(currentLot.countdown_end_at)}
                </div>
              </div>
            )}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 bg-black/70 rounded-lg hover:bg-black/50"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 bg-black/70 rounded-lg hover:bg-black/50"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Current Lot Card */}
          {currentLot ? (
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 rounded-xl border border-green-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-green-400 text-sm font-medium">Current Lot</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Live</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{currentLot.title}</h2>
              {currentLot.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{currentLot.description}</p>
              )}
              
              {(() => {
                let imageUrls: string[] = [];
                if (Array.isArray(currentLot.image_urls)) {
                  imageUrls = currentLot.image_urls;
                } else if (typeof currentLot.image_urls === 'string' && currentLot.image_urls) {
                  try { imageUrls = JSON.parse(currentLot.image_urls); } catch {}
                }
                return imageUrls.length > 0 ? (
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {imageUrls.map((url: string, idx: number) => (
                      <img 
                        key={idx} 
                        src={url} 
                        alt={`Lot image ${idx + 1}`} 
                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                      />
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Starting Bid</p>
                  <p className="text-white font-medium">{currentLot.starting_bid.toLocaleString()} TC</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Min Increment</p>
                  <p className="text-white font-medium">{currentLot.min_increment.toLocaleString()} TC</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 rounded-xl p-4 text-center border border-green-500/50">
                <p className="text-green-400 text-sm mb-1">Current Highest Bid</p>
                <div className="flex items-center justify-center gap-2">
                  <Coins className="w-8 h-8 text-yellow-400" />
                  <span className="text-4xl font-bold text-white">
                    {(currentLot.current_highest_bid || currentLot.starting_bid).toLocaleString()}
                  </span>
                </div>
                {currentLot.current_highest_bidder_id && (
                  <p className="text-gray-400 text-sm mt-1">
                    Highest bidder
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-8 text-center">
              <Gavel className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No lot currently active</p>
            </div>
          )}

          {/* Bid Controls */}
          {currentLot && currentLot.status === 'live' && (
            <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Coins className="w-6 h-6 text-yellow-400" />
                  <span className="text-white font-medium">
                    Your Balance: {(userProfile?.troll_coins || 0).toLocaleString()} coins
                  </span>
                </div>
                {(userProfile?.troll_coins || 0) >= 5000 ? (
                  <span className="flex items-center gap-1 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" /> Eligible to bid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 text-sm">
                    <XCircle className="w-4 h-4" /> Need 5,000+ coins
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex-1 flex gap-2">
                  {[100, 500, 1000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => quickBid(amount)}
                      className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-white font-medium transition-colors"
                    >
                      +{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`Min: ${minBid.toLocaleString()}`}
                    className="w-full py-3 px-4 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">coins</span>
                </div>
                <button
                  onClick={placeBid}
                  disabled={!bidAmount || (userProfile?.troll_coins || 0) < 5000}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none"
                >
                  Place Bid
                </button>
              </div>

              {bidStatus === 'success' && (
                <div className="mt-3 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">Bid accepted!</span>
                </div>
              )}
              {bidStatus === 'error' && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">{bidError}</span>
                </div>
              )}
            </div>
          )}

          {/* Upcoming Lots */}
          {lots.filter(l => l.status === 'upcoming').length > 0 && (
            <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-4">
              <h3 className="text-lg font-bold text-white mb-3">Upcoming Lots</h3>
              <div className="space-y-2">
                {lots.filter(l => l.status === 'upcoming').map((lot, index) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-sm">
                        {index + 1}
                      </span>
                      <span className="text-white">{lot.title}</span>
                    </div>
                    <span className="text-yellow-400 text-sm">Starting: {lot.starting_bid.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Auction Info */}
          <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-bold text-white mb-3">Auction Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Show Title</p>
                <p className="text-white font-medium">{show.title}</p>
              </div>
              {show.category && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Gavel className="w-4 h-4" />
                  <span>{show.category}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-gray-900/80 rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setSelectedTab('bids')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  selectedTab === 'bids' ? 'text-green-400 border-b-2 border-green-400 bg-black/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                Live Bids
              </button>
              <button
                onClick={() => setSelectedTab('info')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  selectedTab === 'info' ? 'text-green-400 border-b-2 border-green-400 bg-black/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setSelectedTab('lot')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  selectedTab === 'lot' ? 'text-green-400 border-b-2 border-green-400 bg-black/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                Lots
              </button>
            </div>

            {selectedTab === 'bids' && (
              <div className="p-3 max-h-80 overflow-y-auto space-y-2">
                {bids.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No bids yet</p>
                ) : (
                  bids.map((bid) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-black/30"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {bid.bidder?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{bid.bidder?.username || 'Anonymous'}</p>
                          <p className="text-gray-500 text-xs">{new Date(bid.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <span className="text-yellow-400 font-bold">
                        {bid.bid_amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'info' && currentLot && (
              <div className="p-3 space-y-3">
                <div>
                  <p className="text-gray-500 text-xs">Current Lot</p>
                  <p className="text-white">{currentLot.title}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Minimum Increment</p>
                  <p className="text-white">{currentLot.min_increment.toLocaleString()} coins</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Lots</p>
                  <p className="text-white">{lots.length}</p>
                </div>
              </div>
            )}

            {selectedTab === 'lot' && (
              <div className="p-3 max-h-80 overflow-y-auto space-y-2">
                {lots.map((lot, idx) => (
                  <div 
                    key={lot.id}
                    className={`p-2 rounded-lg ${
                      lot.id === currentLot?.id 
                        ? 'bg-green-500/20 border border-green-500/30' 
                        : 'bg-black/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-xs">
                        {idx + 1}
                      </span>
                      <span className={`text-sm ${lot.id === currentLot?.id ? 'text-green-400' : 'text-white'}`}>
                        {lot.title}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs ml-7 mt-1">
                      {lot.status === 'sold' 
                        ? `Sold: ${lot.current_highest_bid?.toLocaleString()}` 
                        : lot.status === 'live' 
                        ? `Current: ${lot.current_highest_bid?.toLocaleString() || lot.starting_bid}`
                        : `Starting: ${lot.starting_bid}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Report Button */}
          <button 
            onClick={() => {
              toast.info('Report feature coming soon');
            }}
            className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Flag className="w-4 h-4" />
            Report Issue
          </button>
        </div>
      </div>

      {/* Neon Glow Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}