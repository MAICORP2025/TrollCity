import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { supabase, UserRole } from "../lib/supabase";
import { startCourtSession } from "../lib/courtSessions";
import { toast } from "sonner";
import RequireRole from "../components/RequireRole";
import CourtAIAssistant from "../components/CourtAIAssistant";
import MAIAuthorityPanel from "../components/mai/MAIAuthorityPanel";
import CourtChat from "../components/CourtChat";
import CourtAIController from "../components/CourtAIController";
import UserSearchDropdown from "../components/UserSearchDropdown";
import { Mic, MicOff, Video, VideoOff, User } from "lucide-react";
import { Button } from "../components/ui/button";
import CourtGeminiModal from "../components/CourtGeminiModal";
import CourtDocketModal from "../components/CourtDocketModal";
import { generateSummaryFeedback } from "../lib/courtAi";
import { getGlowingTextStyle } from "../lib/perkEffects";

import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack, IRemoteAudioTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';


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

const CourtVideoGrid = ({ maxTiles, localTracks, remoteUsers, toggleCamera, toggleMicrophone, localUserId, courtSession }: {
  maxTiles: number;
  localTracks: [ILocalVideoTrack | undefined, ILocalAudioTrack | undefined];
  remoteUsers: IAgoraRTCRemoteUser[];
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  localUserId: string;
  courtSession: any; // TODO: Define proper type for courtSession
}) => {
  const localVideoTrack = localTracks[0];
  const localAudioTrack = localTracks[1];

  // Logic to determine who is judge, defendant, etc.
  const judgeUser = remoteUsers.find(user => user.uid === courtSession?.judge_id) ||
                   (localUserId === courtSession?.judge_id ? { uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack } : undefined);
  
  const defendantUser = remoteUsers.find(user => user.uid === courtSession?.defendant_id) ||
                        (localUserId === courtSession?.defendant_id ? { uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack } : undefined);

  const participantUsers = remoteUsers.filter(user => 
    user.uid !== courtSession?.judge_id && 
    user.uid !== courtSession?.defendant_id
  );

  if (localUserId !== courtSession?.judge_id && localUserId !== courtSession?.defendant_id) {
    participantUsers.unshift({ uid: localUserId, videoTrack: localVideoTrack, audioTrack: localAudioTrack });
  }

  const renderParticipantBox = (
    title: string,
    colorClass: string,
    videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined,
    audioTrack: ILocalAudioTrack | IRemoteAudioTrack | undefined,
    isLocal: boolean,
    uid: string,
    username: string,
  ) => {
    const videoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (videoRef.current && videoTrack) {
        videoTrack.play(videoRef.current);
      }
      return () => {
        if (videoTrack) {
          videoTrack.stop();
        }
      };
    }, [videoTrack]);

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

    const isMicOn = audioTrack && audioTrack.enabled;
    const isCamOn = videoTrack && videoTrack.enabled;

    return (
      <div className={`bg-gray-900 rounded-xl overflow-hidden border ${colorClass} aspect-video relative group`}>
        <div className={`absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 backdrop-blur-sm ${colorClass.replace('border-', 'text-')}`}>
          {title}
          <div className="flex gap-1 ml-2">
            {isMicOn ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
          </div>
        </div>

        {videoTrack ? (
          <div ref={videoRef} className="w-full h-full object-cover"></div>
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
        <CourtParticipantLabel uid={uid} username={username} />
      </div>
    );
  };

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
        gridTemplateColumns: `repeat(${getCols()}, minmax(0, 1fr))`
      }}
    >
      {participantsToRender.slice(0, maxTiles).map((p, index) => (
        <div key={p.user.uid} className="tc-neon-frame relative">
          {renderParticipantBox(
            p.title,
            p.colorClass,
            p.user.videoTrack,
            p.user.audioTrack,
            p.user.uid === localUserId,
            p.user.uid,
            p.username
          )}
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



  
  const isValidUuid = (value?: string | null) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || ''
  );

const getAgoraToken = async (room: string, identity: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL for Agora token endpoint');
  }
  const tokenUrl = `${supabaseUrl}/functions/v1/agora-token`;

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
      room: room,
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
    throw new Error('Invalid Agora token response');
  }
  return data.token;
};

export default function CourtRoom() {
   const { user, profile } = useAuthStore();
   const { courtId } = useParams();
   const navigate = useNavigate();



   const [_participantsAllowed, _setParticipantsAllowed] = useState([]);
   const [courtSession, setCourtSession] = useState(null);
   const [boxCount, setBoxCount] = useState(2);
   const [joinBoxRequested, setJoinBoxRequested] = useState(false);
   const [joinBoxLoading, setJoinBoxLoading] = useState(false);
   const [activeBoxCount, setActiveBoxCount] = useState(0);

   const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
   const [localTracks, setLocalTracks] = useState<[ILocalVideoTrack | undefined, ILocalAudioTrack | undefined]>([undefined, undefined]);
   const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  const isJudge =
    profile?.role === 'admin' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.is_admin ||
    profile?.is_lead_officer;

  // Server-side token enforces publish permissions; client mirrors as a UX hint.
  // Judges can always publish, and users with court roles can publish
  const isOfficer = profile?.role === 'troll_officer' || profile?.is_troll_officer;
  const roleCanPublish = Boolean(isJudge) || Boolean(isOfficer) ||
                         ["defendant", "accuser", "witness", "attorney"].includes(profile?.role);
  const canPublish = roleCanPublish || joinBoxRequested;

  useEffect(() => {
    if (!user || !courtId || !isValidUuid(courtId)) return;

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    setAgoraClient(client);

    const join = async () => {
      if (canPublish) {
        try {
          const token = await getAgoraToken(courtId, user.id);
          await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, courtId, token, user.id);
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          const videoTrack = await AgoraRTC.createCameraVideoTrack();
          setLocalTracks([videoTrack, audioTrack]);
          await client.publish([videoTrack, audioTrack]);
        } catch (error) {
          console.error("Failed to auto-join as publisher:", error);
          toast.error("Couldn't connect as a publisher. Joining as viewer.");
          await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, courtId, null, user.id);
        }
      } else {
        await client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, courtId, null, user.id);
      }
    };

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => [...prev.filter(u => u.uid !== user.uid), user]);
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers((prev) => prev.filter(u => u.uid !== user.uid));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);

    join();

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      localTracks[0]?.close();
      localTracks[1]?.close();
      client.leave();
    };
  }, [courtId, user, canPublish]);

  const roomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (courtId && !roomIdRef.current) {
      roomIdRef.current = courtId;
      console.log('[CourtRoom] Room ID stabilized:', courtId);
    }
  }, [courtId]);
  
  // Court functionality state
  const [activeCase, setActiveCase] = useState(null);
  const [courtPhase, setCourtPhase] = useState('waiting'); // waiting, opening, evidence, deliberation, verdict
  const [evidence, setEvidence] = useState([]);
  const [defendant, setDefendant] = useState(null);
  const [judge, setJudge] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [showJudgeControls, setShowJudgeControls] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseData, setNewCaseData] = useState({
    title: '',
    defendant: '',
    accuser: '',
    description: '',
    severity: 'Low'
  });
  const [judgeControls, setJudgeControls] = useState({
    autoLockChat: false,
    requireLeadApproval: false,
    forceCaseRecord: false
  });
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [verdictData, setVerdictData] = useState({
    verdict: 'not_guilty',
    penalty: '',
    reasoning: ''
  });
  const [availableJudges, setAvailableJudges] = useState<Array<{
    id: string
    username: string
    role: string
    is_admin?: boolean
    is_lead_officer?: boolean
  }>>([]);
  const [showJudgeSelection, setShowJudgeSelection] = useState(false);
  const [showSentencingOptions, setShowSentencingOptions] = useState(false);
  const [showPaymentTab, setShowPaymentTab] = useState(false);
  const [sentencingOptions, setSentencingOptions] = useState({
    fines: [],
    bans: [],
    communityService: [],
    otherPenalties: []
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    reason: '',
    recipient: '',
    status: 'pending'
  });
  const [showRoleManagement, setShowRoleManagement] = useState(false);
  const [roleChangeRequest, setRoleChangeRequest] = useState({
    userId: '',
    currentRole: '',
    newRole: '',
    reason: ''
  });
  const [showSummonModal, setShowSummonModal] = useState(false);
  const [summonQuery, setSummonQuery] = useState('');
  const [summaries, setSummaries] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);
  const [defenseCounselEnabled, setDefenseCounselEnabled] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [showDocketModal, setShowDocketModal] = useState(false);


  const isJudge =
    profile?.role === 'admin' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.is_admin ||
    profile?.is_lead_officer;

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

  const effectiveRole = getEffectiveRole();



  // Keep box count in sync for all viewers using Realtime (Push) instead of Polling (Pull)
  useEffect(() => {
    if (!courtId) return;
    if (courtId === 'active' || !isValidUuid(courtId)) return;
    
    // Initial fetch to ensure we have the latest state
    const fetchInitialState = async () => {
      try {
        const { data } = await supabase
          .from('court_sessions')
          .select('max_boxes,status')
          .eq('id', courtId)
          .maybeSingle();

        if (data) {
          if (data.status && !['active', 'live', 'waiting'].includes(data.status)) {
            toast.info('Court session ended');
            navigate('/troll-court');
            return;
          }
          if (typeof data.max_boxes === 'number') {
             setBoxCount((prev) => {
               const newCount = Math.min(4, Math.max(2, data.max_boxes));
               return newCount !== prev ? newCount : prev;
             });
          }
        }
      } catch (err) {
        console.error('Error fetching initial court state:', err);
      }
    };
    
    fetchInitialState();

    const channel = supabase
      .channel(`court_session_updates_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'court_sessions',
          filter: `id=eq.${courtId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.status && !['active', 'live', 'waiting'].includes(newData.status)) {
            toast.info('Court session ended');
            navigate('/troll-court');
            return;
          }
          if (typeof newData.max_boxes === 'number') {
            const newBoxCount = Math.min(4, Math.max(2, newData.max_boxes));
            setBoxCount((prev) => {
              if (prev !== newBoxCount) {
                console.log('[CourtRoom] BoxCount updated via Realtime:', newBoxCount);
                return newBoxCount;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courtId, navigate]);

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

  const handleJoinBox = async () => {
    if (!user || !courtId) return;
    if (joinBoxLoading) return;
    if (activeBoxCount >= boxCount) {
      toast.error('All court boxes are full');
      return;
    }
  }
}