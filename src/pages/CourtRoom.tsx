import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { supabase, UserRole } from "../lib/supabase";
import { startCourtSession } from "../lib/courtSessions";
import { toast } from "sonner";
import RequireRole from "../components/RequireRole";
import CourtChat from "../components/CourtChat";
import UserSearchDropdown from "../components/UserSearchDropdown";
import { Mic, MicOff, Video, VideoOff, User } from "lucide-react";
import { Button } from "../components/ui/button";

import CourtDocketModal from "../components/CourtDocketModal";
import GiftBoxModal from "../components/broadcast/GiftBoxModal";
import { getGlowingTextStyle } from "../lib/perkEffects";
import useLiveKitRoom from "../hooks/useLiveKitRoom";


const CourtParticipantLabel = ({ uid, username: initialUsername }: { uid: string, username: string | null }) => {
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [rgbExpiry, setRgbExpiry] = useState<string | null>(null);
  const [glowingColor, setGlowingColor] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!uid) {
        setUsername(initialUsername);
        return;
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username,rgb_username_expires_at,glowing_username_color')
        .eq('id', uid)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setUsername(initialUsername || uid);
        setRgbExpiry(null);
        setGlowingColor(null);
        return;
      }
      setUsername(data?.username || initialUsername || uid);
      setRgbExpiry(data?.rgb_username_expires_at || null);
      setGlowingColor(data?.glowing_username_color || null);
    };
    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [uid, initialUsername]);
  const isRgbActive =
    rgbExpiry !== null && new Date(rgbExpiry) > new Date();
  
  const glowingStyle = (!isRgbActive && glowingColor) ? getGlowingTextStyle(glowingColor) : undefined;

  return (
    <div className="absolute bottom-2 left-2 right-2 flex justify-center pointer-events-none">
      <span
        className={`px-2 py-1 rounded bg-black/60 text-white text-xs ${
          isRgbActive ? 'rgb-username font-bold' : ''
        }`}
        style={glowingStyle}
      >
        {username || 'Participant'}
      </span>
    </div>
  );
};

type CombinedUserTrack = {
  uid: string | number;
  videoTrack?: ILocalVideoTrack | IRemoteVideoTrack;
  audioTrack?: ILocalAudioTrack | IRemoteAudioTrack;
};

const isValidUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

const ParticipantBox = ({ title, colorClass, videoTrack, audioTrack, isLocal, uid, username, onGiftUser, localUserId, toggleCamera, toggleMicrophone }: any) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const attachedSidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoTrack || !videoContainerRef.current) return;
    
    const trackSid = videoTrack.sid;
    // Already attached this track - don't re-attach
    if (attachedSidRef.current === trackSid) return;
    attachedSidRef.current = trackSid;
    
    while (videoContainerRef.current.firstChild) {
      videoContainerRef.current.removeChild(videoContainerRef.current.firstChild);
    }
    const videoElement = videoTrack.attach();
    videoContainerRef.current.appendChild(videoElement);
    videoElement.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    console.log('[ParticipantBox] Attached', trackSid);
    
    return () => {
      attachedSidRef.current = null;
    };
  }, [videoTrack?.sid]); // Only re-run when track changes

  useEffect(() => {
    if (audioTrack && !isLocal) {
      audioTrack.play();
    }
    return () => {
      if (audioTrack && !isLocal) {
        audioTrack.stop();
      }
    };
  }, [audioTrack, isLocal]);

  const isMicOn = audioTrack ? ('enabled' in audioTrack ? audioTrack.enabled : true) : false;
  const isCamOn = videoTrack ? ('enabled' in videoTrack ? videoTrack.enabled : true) : false;

  const targetUid = String(uid || '');
  const canGift = isValidUuid(targetUid) && targetUid !== localUserId;
  return (
    <div
      className={`bg-gray-900 rounded-xl overflow-hidden border ${colorClass} relative group ${canGift ? 'cursor-pointer hover:border-yellow-400/70' : ''}`}
      style={{ minHeight: '250px', height: '100%' }}
      onClick={() => {
        if (canGift && onGiftUser) onGiftUser(targetUid);
      }}
    >
      <div className={`absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 backdrop-blur-sm ${colorClass.replace('border-', 'text-')}`}>
        {title}
        <div className="flex gap-1 ml-2">
          {isMicOn ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
        </div>
      </div>

      {videoTrack ? (
        <div ref={videoContainerRef} className="w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col gap-2">
          <User size={48} />
          <p>Waiting for {username}...</p>
        </div>
      )}

      {isLocal && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-2 rounded-full backdrop-blur-sm">
          <Button
            size="icon"
            variant={isMicOn ? "ghost" : "destructive"}
            className="h-10 w-10 rounded-full"
            onClick={toggleMicrophone}
          >
            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
          </Button>
          <Button
            size="icon"
            variant={isCamOn ? "ghost" : "destructive"}
            className="h-10 w-10 rounded-full"
            onClick={toggleCamera}
          >
            {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
          </Button>
        </div>
      )}
      <CourtParticipantLabel uid={uid as string} username={username} />
    </div>
  );
};

const CourtVideoGrid = ({ maxTiles, localTracks, remoteUsers, toggleCamera, toggleMicrophone, localUserId, courtSession, onGiftUser }: {
  maxTiles: number;
  localTracks: [ILocalVideoTrack | undefined, ILocalAudioTrack | undefined];
  remoteUsers: RemoteParticipant[];
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  localUserId: string;
  courtSession: any;
  onGiftUser?: (userId: string) => void;
}) => {
  // Persist tracks in ref to survive re-renders
  const tracksRef = useRef(localTracks);
  // Always update ref if localTracks has any track
  if (localTracks && (localTracks[0] || localTracks[1])) {
    tracksRef.current = localTracks;
  }
  const [localVideoTrack, localAudioTrack] = tracksRef.current;

  // Logic to determine who is judge, defendant, etc.
  const judgeUser: CombinedUserTrack | undefined = remoteUsers.find(user => user.uid === courtSession?.judge_id) ||
                   (localUserId === courtSession?.judge_id ? { uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack } : undefined);
  
  const defendantUser: CombinedUserTrack | undefined = remoteUsers.find(user => user.uid === courtSession?.defendant_id) ||
                        (localUserId === courtSession?.defendant_id ? { uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack } : undefined);

  const participantUsers: CombinedUserTrack[] = remoteUsers.filter(user =>
    user.uid !== courtSession?.judge_id &&
    user.uid !== courtSession?.defendant_id
  );

  if (localUserId !== courtSession?.judge_id && localUserId !== courtSession?.defendant_id) {
    participantUsers.unshift({ uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack });
  }

  const getCols = () => {
    const totalParticipants = (judgeUser ? 1 : 0) + (defendantUser ? 1 : 0) + participantUsers.length;
    const cols = Math.max(2, Math.min(totalParticipants, maxTiles || 2));
    if (cols <= 2) return 2;
    if (cols <= 3) return 3;
    return Math.min(cols, 4);
  };

  const participantsToRender = [];
  if (judgeUser) {
    participantsToRender.push({
      title: 'Judge',
      colorClass: 'border-yellow-500',
      user: judgeUser,
      username: courtSession?.judge_username || 'Judge'
    });
  }
  if (defendantUser) {
    participantsToRender.push({
      title: 'Defendant',
      colorClass: 'border-red-500',
      user: defendantUser,
      username: courtSession?.defendant_username || 'Defendant'
    });
  }
  participantUsers.forEach((user, index) => {
    participantsToRender.push({
      title: `Participant ${index + 1}`,
      colorClass: 'border-gray-500',
      user: user,
      username: user.uid === localUserId ? 'You' : `Participant ${index + 1}` // TODO: Fetch actual username
    });
  });

  return (
    <div
      className="w-full h-[60vh] gap-2 p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${getCols()}, minmax(0, 1fr))`,
        minHeight: '300px'
      }}
    >
      {participantsToRender.slice(0, maxTiles).map((p) => (
        <div key={p.user.uid} className="tc-neon-frame relative">
          <ParticipantBox
            title={p.title}
            colorClass={p.colorClass}
            videoTrack={p.user.videoTrack}
            audioTrack={p.user.audioTrack}
            isLocal={p.user.uid === localUserId}
            uid={p.user.uid}
            username={p.username}
            onGiftUser={onGiftUser}
            localUserId={localUserId}
            toggleCamera={toggleCamera}
            toggleMicrophone={toggleMicrophone}
          />
        </div>
      ))}
      {Array.from({ length: Math.max(0, maxTiles - participantsToRender.length) }).map((_, i) => (
        <div 
          key={`ph-${i}`}
          className="tc-neon-frame flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-gray-400 text-sm">Waiting for participant…</div>
        </div>
      ))}
    </div>
  );
}

function uidFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const getLiveKitToken = async (room: string, identity: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL for LiveKit token endpoint');
  }
  const tokenUrl = `${supabaseUrl}/functions/v1/livekit-token`;

  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (!accessToken) throw new Error('No active session');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      channel: room, // Changed from 'room' to 'channel'
      identity: identity,
      role: 'host',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Token request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error('Invalid LiveKit token response');
  }
  return data.token;
};

export default function CourtRoom() {
   const { user, profile } = useAuthStore();
   const { courtId } = useParams();
   const navigate = useNavigate();
   const [courtSession, setCourtSession] = useState<any>(null);
   const [boxCount, setBoxCount] = useState(4);
   const [joinBoxRequested, setJoinBoxRequested] = useState(false);
   const [joinBoxLoading, setJoinBoxLoading] = useState(false);
   const [livekitClient, setLivekitClient] = useState<Room | null>(null);
   const [localTracks, setLocalTracks] = useState<[ILocalVideoTrack | undefined, ILocalAudioTrack | undefined]>([undefined, undefined]);
   const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
   const [activeCase, setActiveCase] = useState<any>(null);
   const [courtState, setCourtState] = useState<any>(null);
 
   const [showDocketModal, setShowDocketModal] = useState(false);
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
   const [giftOpen, setGiftOpen] = useState(false);
   const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);
   const [summaries, setSummaries] = useState<any[]>([]);
   const [showNewCaseModal, setShowNewCaseModal] = useState(false);
const [evidence, setEvidence] = useState<any[]>([]);
    const [verdict, setVerdict] = useState<any>(null);
    const [displayedEvidence, setDisplayedEvidence] = useState<any>(null);
    
    // Court participants and queue
    const [courtParticipants, setCourtParticipants] = useState<any[]>([]);
    const [courtQueue, setCourtQueue] = useState<any[]>([]);
    const [myParticipant, setMyParticipant] = useState<any>(null);
 
const isJudge = user?.id === courtSession?.judge_id || profile?.is_admin;
   const isOfficer = profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_admin;
   const isAttorney = profile?.role === 'attorney';


  // Duration Limit (1 hour)
  useEffect(() => {
    if (courtSession?.created_at) {
        const checkDuration = () => {
            const startedAt = new Date(courtSession.created_at).getTime();
            const duration = Date.now() - startedAt;
            if (duration > 3600000) { // 1 hour
                 // Only show toast once or periodically?
                 // Since this runs every minute, it will toast every minute after 1 hour.
                 // That's acceptable for now to annoy them into ending.
                 if (isJudge) toast.error('Court session time limit (1 hour) reached.');
                 else toast.warning('This court session has exceeded the 1-hour limit.');
            }
        };
        checkDuration(); 
        const interval = setInterval(checkDuration, 60000);
        return () => clearInterval(interval);
    }
  }, [courtSession, isJudge]);

  // Get the effective role for display (prioritize is_admin flag)
  const getEffectiveRole = () => {
    if (profile?.is_admin) return 'admin';
    if (profile?.role === 'admin') return 'admin';
    if (profile?.is_lead_officer) return 'lead_troll_officer';
    if (profile?.role === 'troll_officer') return 'troll_officer';
    return profile?.role || 'user';
  };




  // HARDENED - Multi-step loading and Realtime listeners for court state
  useEffect(() => {
    if (!courtId || !isValidUuid(courtId)) return;

    // 1. Fetch the session, then the case, then the state
    const fetchFullCourtState = async () => {
      // Step 1: Get the court session
      const { data: sessionData, error: sessionError } = await supabase
        .from('court_sessions')
        .select('*')
        .eq('id', courtId)
        .maybeSingle();

      if (sessionError || !sessionData) {
        toast.error("Court session not found or an error occurred.");
        console.error("Error fetching court session:", sessionError?.message);
        navigate('/troll-court');
        return;
      }
      setCourtSession(sessionData);

      if (sessionData.status && !['active', 'live', 'waiting'].includes(sessionData.status)) {
        toast.info('This court session has concluded.');
        navigate('/troll-court');
        return;
      }
      
      const caseId = sessionData?.case_id;
      // Case ID is now optional - court sessions can start without a case
      let caseData = null;
      if (caseId && isValidUuid(caseId)) {
        // Step 2: Get the court case (only if case_id exists)
        const { data: fetchedCase, error: caseError } = await supabase
          .from('court_cases')
          .select('*')
          .eq('id', caseId)
          .maybeSingle();

        if (caseError || !fetchedCase) {
          console.warn("Could not load associated court case, continuing without it:", caseError?.message);
        } else {
          caseData = fetchedCase;
        }
      }
      setActiveCase(caseData);

      // Step 3: Get the court session state (only if caseId is valid)
      let stateData = null;
      if (caseId && isValidUuid(caseId)) {
        const { data: fetchedState, error: stateError } = await supabase
          .from('court_session_state')
          .select('*')
          .eq('case_id', caseId)
          .maybeSingle();

        if (!stateError && fetchedState) {
          stateData = fetchedState;
        }
      }
      setCourtState(stateData);
      setBoxCount(Math.min(6, Math.max(2, sessionData?.max_boxes || 4)));
    };
    
    fetchFullCourtState();

    // REALTIME LISTENERS
    const sessionChannel = supabase
      .channel(`court_session_updates_${courtId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'court_sessions', filter: `id=eq.${courtId}` },
        (payload) => {
          if (!payload || !payload.new) return; // Guard against null payload
          const newData = payload.new as any;
          
          if (newData.status && !['active', 'live', 'waiting'].includes(newData.status)) {
            toast.info('Court session ended');
            navigate('/troll-court');
            return;
          }
          
          if (typeof newData.max_boxes === 'number') {
            const newBoxCount = Math.min(6, Math.max(2, newData.max_boxes || 4));
            setBoxCount(prev => prev !== newBoxCount ? newBoxCount : prev);
          }
        }
      ).subscribe();
      
    const stateChannel = courtSession?.case_id
      ? supabase
          .channel(`court_state_updates_${courtId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'court_session_state', filter: `case_id=eq.${courtSession.case_id}` },
            (payload) => {
                if (!payload || !payload.new) return; // Guard against null payload
                console.log("Received court_session_state update:", payload.new);
                setCourtState(payload.new);
            }
          ).subscribe()
      : supabase.channel(`court_state_updates_${courtId}`).subscribe();

    // Court events subscription for evidence display
    const eventsChannel = supabase
      .channel(`court_events_${courtId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'court_events', filter: `court_session_id=eq.${courtId}` },
        (payload) => {
          if (!payload || !payload.new) return;
          const event = payload.new as any;

          if (event.event_type === 'evidence_shown') {
            setDisplayedEvidence({
              attorney_username: event.event_data.attorney_username,
              evidence_urls: event.event_data.evidence_urls,
              case_id: event.event_data.case_id,
              timestamp: event.created_at
            });
          }
        }
      ).subscribe();


    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [courtId, navigate, user]);

  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);

  const effectiveRole = getEffectiveRole();

  const toggleCamera = () => {
    if (localTracks[0]) {
      localTracks[0].setEnabled(!localTracks[0].enabled);
    }
  };

  const toggleMicrophone = () => {
    if (localTracks[1]) {
      localTracks[1].setEnabled(!localTracks[1].enabled);
    }
  };

  // Court participant functions
  const joinCourtAsRole = async (role: string) => {
    if (!courtId) return;
    try {
      const { data, error } = await supabase.rpc('join_court_session', {
        p_court_session_id: courtId,
        p_role: role
      });
      if (error) throw error;
      if (data?.success) {
        setMyParticipant(data.participant);
        await fetchCourtParticipants();
      }
    } catch (err: any) {
      console.error('Error joining court:', err);
    }
  };

  const raiseHand = async () => {
    if (!courtId) return;
    try {
      const { data, error } = await supabase.rpc('court_raise_hand', {
        p_court_session_id: courtId
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Raised hand! Queue position: ${data.queue_position}`);
        await fetchCourtParticipants();
      }
    } catch (err: any) {
      console.error('Error raising hand:', err);
    }
  };

  const lowerHand = async () => {
    if (!courtId) return;
    try {
      const { data, error } = await supabase.rpc('court_lower_hand', {
        p_court_session_id: courtId
      });
      if (error) throw error;
      if (data?.success) {
        toast.info('Hand lowered');
        await fetchCourtParticipants();
      }
    } catch (err: any) {
      console.error('Error lowering hand:', err);
    }
  };

  const callNextFromQueue = async (boxNumber: number = 3) => {
    if (!courtId || !isJudge) return;
    try {
      const { data, error } = await supabase.rpc('court_call_next', {
        p_court_session_id: courtId,
        p_box_number: boxNumber
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Called next person from queue');
        await fetchCourtParticipants();
      }
    } catch (err: any) {
      console.error('Error calling next:', err);
    }
  };

  const fetchCourtParticipants = async () => {
    if (!courtId) return;
    const { data, error } = await supabase
      .from('court_participants')
      .select('*, user_profiles(username)')
      .eq('court_session_id', courtId);
    
    if (!error && data) {
      setCourtParticipants(data);
      setCourtQueue(data.filter((p: any) => p.queue_position !== null).sort((a: any, b: any) => a.queue_position - b.queue_position));
    }
  };

useEffect(() => {
    if (courtId) {
      fetchCourtParticipants();
    }
  }, [courtId]);

  // Use LiveKit hook for court room (same as TrollPodRoom)
  // Admin/officers are always publishers, plus the judge
  const canPublish = isJudge || isOfficer;
  console.log('[Court] canPublish:', canPublish, 'isJudge:', isJudge, 'isOfficer:', isOfficer, 'userId:', user?.id);
  const {
    isConnected: isLiveKitConnected,
    isPublishing: isLiveKitPublishing,
    remoteUsers: liveKitRemoteUsers,
    localAudioTrack,
    localVideoTrack,
    joinAsPublisher: joinBoxPublisher,
    joinAsAudience: joinBoxAudience,
    leaveRoom: leaveBoxRoom,
    toggleCamera: toggleBoxCamera,
    toggleMicrophone: toggleBoxMic
  } = useLiveKitRoom({
    roomId: courtId || '',
    roomType: 'court',
    audioOnly: false,
    publish: canPublish,
    userName: profile?.username || 'User',
    onUserJoined: (p) => console.log('[Court] User joined:', p.identity),
    onUserLeft: (p) => console.log('[Court] User left:', p.identity),
    onError: (err) => {
      console.error('[Court] LiveKit error:', err);
      toast.error('Audio/Video error: ' + err.message);
    }
  });

  const handleJoinBox = async () => {
    if (!user || !courtId) {
      toast.error('User or court ID not available');
      return;
    }
    setJoinBoxLoading(true);
    
    try {
      // Determine role - judge/officer = publisher, regular = audience
      if (canPublish) {
        console.log('[Court] Calling joinBoxPublisher');
        await joinBoxPublisher(user.id);
        toast.success('Joined box as publisher!');
      } else {
        console.log('[Court] Calling joinBoxAudience');
        await joinBoxAudience(user.id);
        toast.success('Joined as audience!');
      }
      setJoinBoxRequested(true);
    } catch (error: any) {
      console.error('Failed to join box:', error);
      toast.error(`Failed to join box: ${error.message || 'Unknown error'}`);
    } finally {
      setJoinBoxLoading(false);
    }
  };

  const handleLeaveBox = async () => {
    try {
      await leaveBoxRoom();
      setJoinBoxRequested(false);
      toast.info('Left the box');
    } catch (error: any) {
      console.error('Failed to leave box:', error);
      toast.error(`Failed to leave box: ${error.message || 'Unknown error'}`);
    }
  };

  // End Court Session - immediately enacts sentencing
  const handleEndCourt = async () => {
    if (!isJudge && !isOfficer) {
      toast.error('Only judges and officers can end court');
      return;
    }
    if (!confirm('End Court Session? Any pending sentencing will take effect immediately.')) return;
    
    try {
      // Update session status
      await supabase
        .from('court_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', courtId);
      
      // If there's an active case with verdict/sentencing, apply it immediately
      if (activeCase) {
        const sentencing = activeCase.verdict || activeCase.sentence;
        if (sentencing) {
          toast.success('Sentencing in effect: ' + sentencing);
        }
      }
      
      // Leave LiveKit
      await leaveBoxRoom();
      
      toast.success('Court session ended');
      navigate('/troll-court');
    } catch (error: any) {
      console.error('Error ending court:', error);
      toast.error('Failed to end court: ' + error.message);
    }
  };

  const toggleDocketModal = () => setShowDocketModal(!showDocketModal);

  const localUserId = user?.id || '';

  const localUserIsJudge = localUserId === courtSession?.judge_id;

  // Placeholder for sending messages - replace with actual chat integration
  const sendMessage = (message: string) => {
    console.log("Sending message:", message);
    // Logic to send message via WebSocket or other means
  };


  const [summaryFeedbackState, setSummaryFeedbackState] = useState<{ summaryId: string; feedback: string } | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const handleGenerateSummaryFeedback = async (summaryId: string, summaryContent: string) => {
    if (!summaryId || !summaryContent) return;
    setIsSubmittingFeedback(true);
    try {
      await generateSummaryFeedback(summaryFeedbackState.summaryId, user?.id || '', effectiveRole as CourtAgentRole, summaryFeedbackState.feedback);
      toast.success("Feedback generated successfully!");
      // Note: The feedback is saved to the database by the function itself
      // We could fetch updated summaries here if needed
    } catch (error) {
      console.error("Error generating feedback:", error);
      toast.error("Error generating feedback.");
    } finally {
      setIsSubmittingFeedback(false);
      setSummaryFeedbackState(null); // Close feedback modal/state
    }
  };

  const handleSummarizeCourt = async () => {
    setIsSubmittingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-court', {
        body: JSON.stringify({ courtId: courtId }),
      });
      if (error) throw error;
      if (data && data.summary) {
        setSummaries(prev => [...prev, { id: data.summaryId, content: data.summary, created_at: new Date().toISOString() }]);
        toast.success("Court summarized successfully!");
      } else {
        toast.error("Failed to summarize court.");
      }
    } catch (error) {
      console.error("Error summarizing court:", error);
      toast.error("Error summarizing court.");
    } finally {
      setIsSubmittingSummary(false);
    }
  };

  const requestToSpeak = async (role: string) => {
    if (!courtId) return;
    try {
      // Use the same raise hand mechanism for attorneys
      const { data, error } = await supabase.rpc('court_raise_hand', {
        p_court_session_id: courtId
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Attorney request to speak submitted! Queue position: ${data.queue_position}`);
        await fetchCourtParticipants();
      }
    } catch (err: any) {
      console.error('Error requesting to speak:', err);
      toast.error('Failed to request to speak');
    }
  };

  const showAttorneyEvidence = async () => {
    try {
      // Get attorney's case evidence
      const { data: attorneyCase, error: caseError } = await supabase
        .from('attorney_cases')
        .select('case_details')
        .eq('attorney_id', user?.id)
        .eq('status', 'active')
        .single();

      if (caseError) throw caseError;

      const evidence = attorneyCase?.case_details?.evidence || [];
      if (evidence.length === 0) {
        toast.error('No evidence to show');
        return;
      }

      // Display evidence locally and notify others
      setDisplayedEvidence({
        attorney_username: profile?.username,
        evidence_urls: evidence,
        case_id: attorneyCase.case_id,
        timestamp: new Date().toISOString()
      });

      // Create a court event to show evidence
      const { error: eventError } = await supabase
        .from('court_events')
        .insert({
          court_session_id: courtId,
          event_type: 'evidence_shown',
          event_data: {
            attorney_id: user?.id,
            attorney_username: profile?.username,
            evidence_urls: evidence,
            case_id: attorneyCase.case_id
          },
          created_by: user?.id
        });

      if (eventError) throw eventError;

      toast.success('Evidence displayed in court');
    } catch (error) {
      console.error('Error showing evidence:', error);
      toast.error('Failed to show evidence');
    }
  };

  return (
    <RequireRole roles={[UserRole.ADMIN, UserRole.LEAD_TROLL_OFFICER, UserRole.TROLL_OFFICER, UserRole.USER]} fallbackPath="/access-denied">
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-3xl font-bold text-center mb-6 tc-neon-text">
          Courtroom {courtId}
        </h1>

        {courtSession && (
          <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Session Details</h2>
            <p><strong>Status:</strong> {courtSession.status}</p>
            {courtSession.court_cases && courtSession.court_cases[0] && (
              <div className="mt-4">
                <h3 className="text-lg font-medium">Active Case: {courtSession.court_cases[0].title}</h3>
                <p><strong>Defendant:</strong> {courtSession.defendant_username || 'N/A'}</p>
                <p><strong>Judge:</strong> {courtSession.judge_username || 'N/A'}</p>
                <p><strong>Phase:</strong> {courtState?.phase || 'waiting'}</p>
                {activeCase?.description && <p><strong>Description:</strong> {activeCase.description}</p>}
                {verdict && <p><strong>Verdict:</strong> {verdict}</p>}
              </div>
            )}
          </div>
        )}

        <CourtVideoGrid
          maxTiles={boxCount}
          localTracks={[localVideoTrack, localAudioTrack]}
          remoteUsers={liveKitRemoteUsers}
          toggleCamera={toggleBoxCamera}
          toggleMicrophone={toggleBoxMic}
          localUserId={user?.id || ''}
          courtSession={courtSession}
          onGiftUser={(targetUserId) => {
            if (!user) {
              navigate('/auth?mode=signup');
              return;
            }
            if (targetUserId === user.id) {
              toast.error('You cannot gift yourself');
              return;
            }
            setGiftRecipientId(targetUserId);
            setGiftOpen(true);
          }}
        />

        {/* Court Queue UI */}
        {courtQueue.length > 0 && (
          <div className="bg-gray-800 p-4 rounded-lg mt-4">
            <h3 className="text-lg font-semibold mb-2">Court Queue</h3>
            <ul className="space-y-2">
              {courtQueue.map((q: any, idx: number) => (
                <li key={q.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                  <span>#{idx + 1} {q.user_profiles?.username || 'Unknown'}</span>
                  {isJudge && (
                    <Button size="sm" onClick={() => callNextFromQueue(idx + 3)}>
                      Call to Box {idx + 3}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Role Selection */}
        <div className="flex justify-center gap-4 mt-4 flex-wrap">
          {!myParticipant && (
            <>
              <Button onClick={() => joinCourtAsRole('prosecutor')} variant="outline">
                Join as Prosecutor
              </Button>
              <Button onClick={() => joinCourtAsRole('attorney')} variant="outline">
                Join as Attorney
              </Button>
              {!isOfficer && (
                <Button onClick={raiseHand} variant="outline">
                  Raise Hand
                </Button>
              )}
            </>
          )}
          {myParticipant?.is_hand_raised && (
            <Button onClick={lowerHand} variant="destructive">
              Lower Hand
            </Button>
          )}
        </div>

        <div className="flex justify-center gap-4 mt-4">
          <Button onClick={handleJoinBox} disabled={joinBoxLoading || joinBoxRequested}>
            {joinBoxLoading ? 'Joining...' : 'Join Box'}
          </Button>
          <Button onClick={handleLeaveBox} disabled={!joinBoxRequested} variant="destructive">
            Leave Box
          </Button>
          {joinBoxRequested && canPublish && (
            <>
              <Button onClick={toggleBoxMic}>
                {localAudioTrack?.isEnabled ? 'Mute Mic' : 'Unmute Mic'}
              </Button>
              <Button onClick={toggleBoxCamera}>
                {localVideoTrack?.isEnabled ? 'Camera Off' : 'Camera On'}
              </Button>
            </>
          )}
          {(isJudge || isOfficer) && (
            <Button onClick={handleEndCourt} variant="destructive">
              End Court
            </Button>
          )}
          {localUserIsJudge && (
            <Button onClick={() => setShowNewCaseModal(true)}>Start New Case</Button>
          )}
          <Button onClick={() => setShowDocketModal(true)}>View Docket</Button>
        </div>

        {/* Attorney Controls */}
        {isAttorney && (
          <div className="flex justify-center gap-4 mt-4">
            <Button onClick={() => requestToSpeak('attorney')} variant="outline">
              Request to Speak
            </Button>
            <Button onClick={() => showAttorneyEvidence()} variant="outline">
              Show Evidence
            </Button>
          </div>
        )}

        {/* Evidence Display */}
        {displayedEvidence && (
          <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-400">
                Evidence Presented by {displayedEvidence.attorney_username}
              </h3>
              <Button
                onClick={() => setDisplayedEvidence(null)}
                size="sm"
                variant="outline"
              >
                Close
              </Button>
            </div>
            <div className="space-y-2">
              {displayedEvidence.evidence_urls.map((url: string, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">Exhibit {index + 1}:</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline text-sm"
                  >
                    {url.length > 50 ? url.substring(0, 50) + '...' : url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modals and other components */}

        <CourtDocketModal
          isOpen={showDocketModal}
          onClose={() => setShowDocketModal(false)}
          courtId={courtId}
          isJudge={isJudge}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <CourtChat courtId={courtId} isLocked={!isJudge} />
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Court Controls & Info</h2>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Summaries</h3>
              <Button onClick={handleSummarizeCourt} disabled={isSubmittingSummary}>
                {isSubmittingSummary ? 'Summarizing...' : 'Summarize Court'}
              </Button>
              {summaries.length > 0 && (
                <div className="mt-4 space-y-2">
                  {summaries.map((s) => (
                    <div key={s.id} className="bg-gray-700 p-3 rounded text-sm">
                      <p className="font-semibold">Summary ({new Date(s.created_at).toLocaleString()}):</p>
                      <p>{s.content}</p>
                      {s.feedback && (
                        <div className="mt-2 text-xs text-gray-400">
                          <strong>AI Feedback:</strong> {s.feedback}
                        </div>
                      )}
                      {isJudge && !s.feedback && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setSummaryFeedbackState({ summaryId: s.id, feedback: s.content })}
                          disabled={isSubmittingFeedback}
                        >
                          Generate Feedback
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {summaryFeedbackState && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-1/2">
              <h2 className="text-xl font-semibold mb-4">Generate Feedback for Summary</h2>
              <p className="mb-4">Are you sure you want to generate AI feedback for this summary?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSummaryFeedbackState(null)} disabled={isSubmittingFeedback}>
                  Cancel
                </Button>
                <Button onClick={() => handleGenerateSummaryFeedback(summaryFeedbackState.summaryId, summaryFeedbackState.feedback)} disabled={isSubmittingFeedback}>
                  {isSubmittingFeedback ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <GiftBoxModal
          isOpen={giftOpen}
          onClose={() => {
            setGiftOpen(false);
            setGiftRecipientId(null);
          }}
          recipientId={giftRecipientId || ''}
          streamId=""
        />

      </div>
    </RequireRole>
  );
}
