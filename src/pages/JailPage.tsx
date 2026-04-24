import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useJailMode } from '../hooks/useJailMode';
import { supabase } from '../lib/supabase';
import { formatDuration } from '../utils/time';
import { toast } from 'sonner';
import { 
  Lock, Clock, MessageSquare, Send, Radio, Play, X, DollarSign, ChevronRight,
  Gavel, User, FileText, Handshake, Calendar, AlertTriangle, CheckCircle,
  Ban, Eye, Scale
} from 'lucide-react';

interface InmateMessage {
  id: string;
  sender_id: string;
  sender_username?: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface TCNNLive {
  id: string;
  title: string;
  is_live: boolean;
  hls_url?: string;
}

interface JailRecord {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  sentence_days: number;
  bond_amount: number;
  bond_posted: boolean;
  arrested_by: string;
  created_at: string;
  release_time: string;
}

interface CourtCase {
  id: string;
  case_number: string;
  defendant_id: string;
  title: string;
  reason: string;
  description: string;
  status: string;
  filing_date: string;
  court_date: string;
  judgment: string;
}

interface AttorneyCase {
  id: string;
  attorney_id?: string;
  victim_id: string;
  status: string;
  case_details?: any;
}

const MESSAGE_COST = 10;

export default function JailPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { isJailed, jailTimeRemaining, releaseTime } = useJailMode(user?.id);
  
  const [messages, setMessages] = useState<InmateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [tcnnLive, setTcnnLive] = useState<TCNNLive | null>(null);
  const [isTcnnPlaying, setIsTcnnPlaying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [jailRecord, setJailRecord] = useState<JailRecord | null>(null);
  const [courtCase, setCourtCase] = useState<CourtCase | null>(null);
  const [attorneyCase, setAttorneyCase] = useState<AttorneyCase | null>(null);
  const [attorneyProfile, setAttorneyProfile] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [hasBail, setHasBail] = useState(false);
  const [postingBail, setPostingBail] = useState(false);
  const [requestingAttorney, setRequestingAttorney] = useState(false);

  useEffect(() => {
    if (user && isJailed) {
      fetchJailData();
      fetchInmateMessages();
      checkTcnnLive();
    }
  }, [user, isJailed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isTcnnPlaying && videoRef.current && tcnnLive?.hls_url) {
      videoRef.current.src = tcnnLive.hls_url;
      videoRef.current.play().catch(console.error);
    } else if (!isTcnnPlaying && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isTcnnPlaying, tcnnLive]);

  const fetchJailData = async () => {
    if (!user) return;
    try {
      setLoadingData(true);
      
      const { data: jailData } = await supabase
        .from('jail')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jailData) {
        setJailRecord(jailData);
        setHasBail(jailData.bond_posted || false);
      }

      if (jailData?.defendant_id) {
        const { data: caseData } = await supabase
          .from('court_cases')
          .select('*')
          .eq('defendant_id', user.id)
          .in('status', ['pending', 'scheduled', 'in_session'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (caseData) {
          setCourtCase(caseData);
        }
      }

      const { data: attorneyData } = await supabase
        .from('attorney_cases')
        .select('*')
        .eq('victim_id', user.id)
        .in('status', ['active', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attorneyData) {
        setAttorneyCase(attorneyData);
        
        if (attorneyData.attorney_id) {
          const { data: attorneyUser } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, role')
            .eq('id', attorneyData.attorney_id)
            .maybeSingle();
          
          setAttorneyProfile(attorneyUser);
        }
      } else {
        const { data: openRequest } = await supabase
          .from('attorney_cases')
          .select('*')
          .eq('victim_id', user.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (openRequest) {
          setAttorneyCase(openRequest);
        }
      }
    } catch (err) {
      console.error('Error fetching jail data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePayBail = async () => {
    if (!user || !jailRecord?.bond_amount) return;
    
    if (profile?.troll_coins < jailRecord.bond_amount) {
      toast.error('Not enough Troll Coins to pay bail');
      return;
    }

    setPostingBail(true);
    try {
      const { error } = await supabase
        .from('jail')
        .update({ bond_posted: true })
        .eq('id', jailRecord.id);

      if (error) throw error;

      setHasBail(true);
      toast.success('Bail posted! You may be released pending trial.');
      fetchJailData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post bail');
    } finally {
      setPostingBail(false);
    }
  };

  const handleRequestAttorney = async () => {
    if (!user) return;

    setRequestingAttorney(true);
    try {
      const { data: existingCase } = await supabase
        .from('attorney_cases')
        .select('id')
        .eq('victim_id', user.id)
        .in('status', ['open', 'active'])
        .limit(1)
        .maybeSingle();

      if (existingCase) {
        toast.info('Attorney request already exists');
        setRequestingAttorney(false);
        return;
      }

      const { error } = await supabase
        .from('attorney_cases')
        .insert({
          victim_id: user.id,
          case_details: {
            reason: jailRecord?.reason || 'Criminal Defense',
            case_type: 'defense'
          },
          status: 'open'
        });

      if (error) throw error;

      toast.success('Attorney request submitted. Waiting for attorney to take your case.');
      fetchJailData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to request attorney');
    } finally {
      setRequestingAttorney(false);
    }
  };

  const fetchInmateMessages = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('inmate_messages')
        .select('*')
        .or(`inmate_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

       const senderIds = [...new Set((data || []).map(m => m.sender_id).filter(Boolean))];
       const senderMap: Record<string, any> = {};
      if (senderIds.length > 0) {
        const { data: senderData } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', senderIds);
        if (senderData) {
          senderData.forEach(s => { senderMap[s.id] = s; });
        }
      }

      const transformed = (data || []).map((msg: any) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender_username: senderMap[msg.sender_id]?.username || 'Unknown',
        message: msg.message,
        created_at: msg.created_at,
        is_read: msg.is_read
      }));

      setMessages(transformed);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const checkTcnnLive = async () => {
    try {
      const { data } = await supabase
        .from('streams')
        .select('id, title, is_live, hls_url')
        .eq('category', 'tcnn')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setTcnnLive(data[0]);
        setIsTcnnPlaying(true);
      } else {
        setTcnnLive(null);
        setIsTcnnPlaying(false);
      }
    } catch (err) {
      console.error('Error checking TCNN:', err);
      setTcnnLive(null);
      setIsTcnnPlaying(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim()) return;
    
    const { data: jailData } = await supabase
      .from('jail')
      .select('message_minutes, message_minutes_used, free_message_used')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const remainingMinutes = (jailData?.message_minutes || 1) - (jailData?.message_minutes_used || 0);
    const isFreeMessage = !jailData?.free_message_used;

    if (remainingMinutes <= 0 && !isFreeMessage) {
      toast.error('No message minutes remaining. Ask family/friends to purchase more.');
      return;
    }

    try {
      setSendingMessage(true);

      const { error } = await supabase
        .from('inmate_messages')
        .insert({
          inmate_id: user.id,
          sender_id: user.id,
          recipient_id: user.id,
          message: newMessage,
          cost: MESSAGE_COST,
          is_free_message: isFreeMessage
        });

      if (error) throw error;

      if (isFreeMessage) {
        await supabase
          .from('jail')
          .update({ free_message_used: true })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('jail')
          .update({ message_minutes_used: (jailData?.message_minutes_used || 0) + 1 })
          .eq('user_id', user.id);
      }

      setNewMessage('');
      fetchInmateMessages();
      toast.success(isFreeMessage ? 'Free message sent!' : 'Message sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (user && !isJailed) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isJailed, navigate, user]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'jailed': 'bg-red-500/20 text-red-400 border-red-500/30',
      'active': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'awaiting_trial': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'on_bail_hold': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'released': 'bg-green-500/20 text-green-400 border-green-500/30',
      'released_pending_trial': 'bg-green-500/20 text-green-400 border-green-500/30'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getCaseStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'scheduled': 'bg-orange-500/20 text-orange-400',
      'in_session': 'bg-blue-500/20 text-blue-400',
      'resolved': 'bg-green-500/20 text-green-400',
      'dismissed': 'bg-red-500/20 text-red-400'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  if (!isJailed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 text-center border-t-4 border-green-600">
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-green-900/20 p-6 rounded-lg border border-green-900/50">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-full animate-ping opacity-20" />
                <div className="absolute w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="text-xl font-bold text-green-400 mb-2">Sentence Completed!</p>
              <p className="text-gray-300">You have been processed for release.</p>
            </div>
            
            <button 
              onClick={() => navigate('/')}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20"
            >
              Return to Society
            </button>
            <p className="text-xs text-gray-500">Redirecting in 3 seconds...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex">
      <div className="flex-1 flex flex-col">
        <div className="bg-red-900/40 border-b-2 border-red-600 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-600/30 rounded-xl flex items-center justify-center border-2 border-red-500 shadow-lg shadow-red-900/50">
                <Lock className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-red-500 drop-shadow-lg">Incarcerated</h1>
                <p className="text-gray-400 text-sm">Access to city services suspended</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Time Remaining</p>
                <p className="text-3xl font-mono font-bold text-red-400 tracking-widest">
                  {jailTimeRemaining !== null ? formatDuration(jailTimeRemaining) : '---'}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-lg border ${getStatusBadge(jailRecord?.status || 'jailed')}`}>
                <span className="font-bold uppercase text-sm">{jailRecord?.status || 'Active'}</span>
              </div>
            </div>
          </div>
        </div>

        {tcnnLive && isTcnnPlaying && (
          <div className="bg-purple-900/30 border-b border-purple-500/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <Radio className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-semibold">TCNN Live</span>
                <span className="text-gray-300">{tcnnLive.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsTcnnPlaying(!isTcnnPlaying)} className="p-2 hover:bg-white/10 rounded-lg">
                  {isTcnnPlaying ? <X className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => navigate('/tcnn/dashboard')} className="text-purple-400 hover:text-purple-300 text-sm">
                  View <ChevronRight className="w-4 h-4 inline" />
                </button>
              </div>
            </div>
            {tcnnLive.hls_url && (
              <div className="w-full h-32 bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" controls={false} autoPlay muted playsInline src={tcnnLive.hls_url} onError={() => {}} />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">
                <Scale className="w-5 h-5" />
                Legal Summary
              </h2>
              
              {loadingData ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Charge</span>
                    <span className="text-white font-medium">{jailRecord?.reason || 'Pending'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Arrested By</span>
                    <span className="text-white">{jailRecord?.arrested_by || 'Troll Officers'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Arrest Date</span>
                    <span className="text-white">{jailRecord?.created_at ? new Date(jailRecord.created_at).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sentence</span>
                    <span className="text-white">{jailRecord?.sentence_days || 0} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Release Date</span>
                    <span className="text-white">{releaseTime ? new Date(releaseTime).toLocaleString() : 'Processing...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bail Amount</span>
                    <span className="text-green-400 font-bold">{jailRecord?.bond_amount || 0} TC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bail Status</span>
                    <span className={hasBail ? 'text-green-400' : 'text-yellow-400'}>{hasBail ? 'Paid' : 'Not Paid'}</span>
                  </div>
                  {courtCase && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Case #</span>
                        <span className="text-white">{courtCase.case_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Court Status</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getCaseStatusBadge(courtCase.status)}`}>{courtCase.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Court Date</span>
                        <span className="text-white">{courtCase.court_date ? new Date(courtCase.court_date).toLocaleString() : 'Not Scheduled'}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Restrictions Apply
              </p>
              <ul className="text-gray-400 text-sm space-y-1.5">
                <li className="flex items-center gap-2"><Ban className="w-3 h-3 text-red-400" /> Cannot go live</li>
                <li className="flex items-center gap-2"><Ban className="w-3 h-3 text-red-400" /> Cannot join lives/battles</li>
                <li className="flex items-center gap-2"><Ban className="w-3 h-3 text-red-400" /> Cannot gift</li>
                <li className="flex items-center gap-2"><Ban className="w-3 h-3 text-red-400" /> Cannot use auctions</li>
                <li className="flex items-center gap-2"><Ban className="w-3 h-3 text-red-400" /> Cannot post freely</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Legal communication allowed</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
                <Gavel className="w-5 h-5" />
                Legal Actions
              </h2>
              <div className="space-y-2">
                {jailRecord?.bond_amount > 0 && !hasBail && (
                  <button
                    onClick={handlePayBail}
                    disabled={postingBail || (profile?.troll_coins || 0) < (jailRecord?.bond_amount || 0)}
                    className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Pay Bail ({jailRecord.bond_amount} TC)
                  </button>
                )}
                
                {!attorneyCase && (
                  <button
                    onClick={handleRequestAttorney}
                    disabled={requestingAttorney}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Request Attorney
                  </button>
                )}

                {courtCase && (
                  <button
                    onClick={() => navigate('/troll-court')}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    View Court Docket
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Court Case
              </h2>
              
              {courtCase ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Case Number</span>
                    <span className="font-mono text-purple-400">{courtCase.case_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Title</span>
                    <span className="text-white">{courtCase.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reason</span>
                    <span className="text-white">{courtCase.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Description</span>
                    <span className="text-white">{courtCase.description || 'No description'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-2 py-0.5 rounded ${getCaseStatusBadge(courtCase.status)}`}>{courtCase.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Filing Date</span>
                    <span className="text-white">{courtCase.filing_date ? new Date(courtCase.filing_date).toLocaleDateString() : '-'}</span>
                  </div>
                  {courtCase.court_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Court Date</span>
                      <span className="text-orange-400 font-semibold">{new Date(courtCase.court_date).toLocaleString()}</span>
                    </div>
                  )}
                  {courtCase.judgment && (
                    <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                      <span className="text-yellow-400 text-sm font-semibold">Judgment:</span>
                      <p className="text-white text-sm">{courtCase.judgment}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No court case has been filed yet.</p>
                  <p className="text-xs mt-1">Cases are typically filed within 48 hours of arrest.</p>
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Handshake className="w-5 h-5 text-blue-400" />
                Attorney
              </h2>
              
              {attorneyCase ? (
                attorneyCase.status === 'open' ? (
                  <div className="text-center py-6 text-yellow-400">
                    <Clock className="w-10 h-10 mx-auto mb-2" />
                    <p className="font-semibold">Attorney Request Submitted</p>
                    <p className="text-xs text-gray-400 mt-1">Waiting for an attorney to take your case</p>
                  </div>
                ) : attorneyProfile ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                      {attorneyProfile.avatar_url ? (
                        <img src={attorneyProfile.avatar_url} alt={attorneyProfile.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-purple-600">
                          <User className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold">{attorneyProfile.username}</p>
                      <p className="text-gray-400 text-sm capitalize">{attorneyCase.status}</p>
                      {attorneyCase.case_details?.notes && (
                        <p className="text-gray-500 text-sm mt-2">{attorneyCase.case_details.notes}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No attorney assigned</p>
                    <button
                      onClick={handleRequestAttorney}
                      disabled={requestingAttorney}
                      className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg font-semibold text-sm"
                    >
                      Request Attorney
                    </button>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No attorney assigned</p>
                  <button
                    onClick={handleRequestAttorney}
                    disabled={requestingAttorney}
                    className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg font-semibold text-sm"
                  >
                    Request Attorney
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col max-h-[400px]">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  Inmate Communication
                </h2>
                <span className="text-xs text-gray-500">{MESSAGE_COST} TC per message</span>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[250px]">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-xs">Contact admin, lead officer, or attorney</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg ${
                      msg.sender_id === user?.id
                        ? 'bg-blue-900/30 border border-blue-500/30 ml-8'
                        : 'bg-gray-700/50 mr-8'
                    }`}>
                      <p className="text-xs text-gray-400 mb-1">{msg.sender_username}</p>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message approved contacts..."
                    className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Messages can only be sent to admin, lead troll officers, and assigned attorneys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}