import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useJailMode } from '../hooks/useJailMode';
import { supabase } from '../lib/supabase';
import { formatDuration } from '../utils/time';
import { toast } from 'sonner';
import {
  Lock,
  Clock,
  MessageSquare,
  Send,
  Radio,
  Play,
  X,
  DollarSign,
  ChevronRight,
  Gavel,
  User,
  FileText,
  Handshake,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Ban,
  Scale,
  ShieldAlert,
  DoorClosed,
  Siren,
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
  court_date?: string | null;
  defendant_id?: string;
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

const cellPanel =
  'rounded-2xl border border-zinc-700/80 bg-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl';

const warningPanel =
  'rounded-2xl border border-yellow-700/50 bg-yellow-950/20 shadow-[0_0_24px_rgba(202,138,4,0.08)]';

const dangerButton =
  'rounded-xl border border-red-700/50 bg-red-950/70 px-4 py-2 font-bold text-red-100 transition hover:border-red-500 hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-50';

const blueButton =
  'rounded-xl border border-cyan-700/50 bg-cyan-950/70 px-4 py-2 font-bold text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-900/70 disabled:cursor-not-allowed disabled:opacity-50';

const greenButton =
  'rounded-xl border border-emerald-700/50 bg-emerald-950/70 px-4 py-2 font-bold text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-50';

function JailBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#050505] via-[#111111] to-[#050505]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(185,28,28,0.25),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(113,113,122,0.16),transparent_32%),radial-gradient(circle_at_50%_90%,rgba(30,41,59,0.24),transparent_35%)]" />

      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      <div className="absolute inset-0 opacity-25">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-[10px] bg-gradient-to-b from-zinc-400/20 via-zinc-900/50 to-black/70 shadow-[0_0_12px_rgba(0,0,0,0.8)]"
            style={{ left: `${i * 7}%` }}
          />
        ))}
      </div>

      <div className="absolute left-0 top-0 h-32 w-full bg-gradient-to-b from-red-950/35 to-transparent" />
      <div className="absolute bottom-0 h-40 w-full bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  tone = 'red',
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  tone?: 'red' | 'yellow' | 'blue' | 'green' | 'gray';
}) {
  const color =
    tone === 'yellow'
      ? 'text-yellow-300 border-yellow-700/40 bg-yellow-950/30'
      : tone === 'blue'
        ? 'text-cyan-300 border-cyan-700/40 bg-cyan-950/30'
        : tone === 'green'
          ? 'text-emerald-300 border-emerald-700/40 bg-emerald-950/30'
          : tone === 'gray'
            ? 'text-zinc-300 border-zinc-700/40 bg-zinc-900/60'
            : 'text-red-300 border-red-700/40 bg-red-950/30';

  return (
    <div className="mb-4 flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-lg font-black uppercase tracking-[0.12em] text-zinc-100">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function JailPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
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
    if (!user || !isJailed) return;

    const channel = supabase
      .channel(`inmate-messages:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inmate_messages',
          filter: `inmate_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id === user.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [
                ...prev,
                {
                  id: newMsg.id,
                  sender_id: newMsg.sender_id,
                  sender_username: profile?.username || 'You',
                  message: newMsg.message,
                  created_at: newMsg.created_at,
                  is_read: false,
                },
              ];
            });
          } else {
            supabase
              .from('user_profiles')
              .select('username')
              .eq('id', newMsg.sender_id)
              .single()
              .then(({ data: sender }) => {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [
                    ...prev,
                    {
                      id: newMsg.id,
                      sender_id: newMsg.sender_id,
                      sender_username: sender?.username || 'Unknown',
                      message: newMsg.message,
                      created_at: newMsg.created_at,
                      is_read: false,
                    },
                  ];
                });
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isJailed, profile?.username]);

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

      const { data: caseData } = await supabase
        .from('court_cases')
        .select('*')
        .eq('defendant_id', user.id)
        .in('status', ['pending', 'scheduled', 'in_session'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (caseData) setCourtCase(caseData);

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
      }
    } catch (err) {
      console.error('Error fetching jail data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePayBail = async () => {
    if (!user || !jailRecord?.bond_amount) return;

    if ((profile?.troll_coins || 0) < jailRecord.bond_amount) {
      toast.error('Not enough Troll Coins to pay bail');
      return;
    }

    setPostingBail(true);

    try {
      const newBalance = Number(profile?.troll_coins || 0) - Number(jailRecord.bond_amount || 0);
      const nowIso = new Date().toISOString();

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          troll_coins: newBalance,
          is_jailed: false,
          updated_at: nowIso,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error } = await supabase
        .from('jail')
        .update({
          bond_posted: true,
          status: 'released_pending_trial',
          release_time: nowIso,
        })
        .eq('id', jailRecord.id);

      if (error) throw error;

      await supabase.from('jail_transactions').insert({
        jail_id: jailRecord.id,
        user_id: user.id,
        amount: jailRecord.bond_amount,
        transaction_type: 'bail_paid',
        description: 'Bail paid by inmate for instant release pending court',
      }).then(() => undefined, () => undefined);

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'jail_release_completed',
        title: 'Released on Bail',
        message: 'You have been released. Make sure you show up for court to avoid being arrested for failure to appear.',
        metadata: {
          jail_id: jailRecord.id,
          bond_amount: jailRecord.bond_amount,
          court_date: courtCase?.court_date || jailRecord.court_date,
          action_url: courtCase ? '/troll-court' : '/jail',
        },
        priority: 'high',
      }).then(() => undefined, () => undefined);

      setHasBail(true);
      setJailRecord((current) =>
        current
          ? {
              ...current,
              bond_posted: true,
              status: 'released_pending_trial',
              release_time: nowIso,
            }
          : current
      );
      if (profile) setProfile({ ...profile, troll_coins: newBalance, is_jailed: false } as any);
      toast.success('Bail paid. You have been released. Show up for court to avoid failure to appear.');
      navigate('/', { replace: true });
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

      const { error } = await supabase.from('attorney_cases').insert({
        victim_id: user.id,
        case_details: {
          reason: jailRecord?.reason || 'Criminal Defense',
          case_type: 'defense',
        },
        status: 'open',
      });

      if (error) throw error;

      toast.success('Attorney request submitted.');
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
        .select('id, sender_id, message, created_at, is_read')
        .eq('inmate_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const senderIds = [...new Set((data || []).map((m) => m.sender_id).filter(Boolean))];
      const senderMap: Record<string, any> = {};

      if (senderIds.length > 0) {
        const { data: senderData } = await supabase.from('user_profiles').select('id, username').in('id', senderIds);
        senderData?.forEach((s) => {
          senderMap[s.id] = s;
        });
      }

      setMessages(
        (data || []).map((msg: any) => ({
          id: msg.id,
          sender_id: msg.sender_id,
          sender_username: senderMap[msg.sender_id]?.username || 'Unknown',
          message: msg.message,
          created_at: msg.created_at,
          is_read: msg.is_read,
        }))
      );
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

      const { error } = await supabase.from('inmate_messages').insert({
        inmate_id: user.id,
        sender_id: user.id,
        recipient_id: user.id,
        message: newMessage.trim(),
        cost: MESSAGE_COST,
        is_free_message: isFreeMessage,
      });

      if (error) throw error;

      if (isFreeMessage) {
        await supabase.from('jail').update({ free_message_used: true }).eq('user_id', user.id);
      } else {
        await supabase
          .from('jail')
          .update({ message_minutes_used: (jailData?.message_minutes_used || 0) + 1 })
          .eq('user_id', user.id);
      }

      setNewMessage('');
      fetchInmateMessages();
      toast.success(isFreeMessage ? 'Free message sent.' : 'Message sent.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (user && !isJailed) {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [isJailed, navigate, user]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      jailed: 'bg-red-950/70 text-red-200 border-red-700/60',
      active: 'bg-yellow-950/60 text-yellow-200 border-yellow-700/50',
      awaiting_trial: 'bg-orange-950/60 text-orange-200 border-orange-700/50',
      on_bail_hold: 'bg-cyan-950/60 text-cyan-200 border-cyan-700/50',
      released: 'bg-emerald-950/60 text-emerald-200 border-emerald-700/50',
      released_pending_trial: 'bg-emerald-950/60 text-emerald-200 border-emerald-700/50',
    };

    return colors[status] || 'bg-zinc-900 text-zinc-300 border-zinc-700';
  };

  const getCaseStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-950/60 text-yellow-200 border-yellow-700/50',
      scheduled: 'bg-orange-950/60 text-orange-200 border-orange-700/50',
      in_session: 'bg-cyan-950/60 text-cyan-200 border-cyan-700/50',
      resolved: 'bg-emerald-950/60 text-emerald-200 border-emerald-700/50',
      dismissed: 'bg-red-950/60 text-red-200 border-red-700/50',
    };

    return colors[status] || 'bg-zinc-900 text-zinc-300 border-zinc-700';
  };

  if (!isJailed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4 text-white">
        <JailBackdrop />
        <div className={`${cellPanel} relative z-10 w-full max-w-md p-8 text-center`}>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-950/40">
            <CheckCircle className="h-10 w-10 text-emerald-300" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-[0.15em] text-emerald-300">Released</h1>
          <p className="mt-3 text-zinc-400">Your sentence has been completed. You are being returned to society.</p>
          <button onClick={() => navigate('/')} className={`${greenButton} mt-7 w-full py-3`}>
            Return to Society
          </button>
          <p className="mt-3 text-xs text-zinc-600">Redirecting in 3 seconds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <JailBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b-4 border-red-950 bg-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-red-800 bg-red-950/70 shadow-[0_0_30px_rgba(127,29,29,0.45)]">
                <Siren className="h-8 w-8 text-red-300" />
                <span className="absolute -right-1 -top-1 h-4 w-4 animate-pulse rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">Troll City Correctional Facility</p>
                <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-zinc-100 md:text-4xl">
                  Inmate Lockdown
                </h1>
                <p className="mt-1 text-sm text-zinc-500">City privileges suspended until release or court order.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-red-900/70 bg-red-950/30 px-5 py-3 text-right">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Time Remaining</p>
                <p className="font-mono text-3xl font-black tracking-widest text-red-300">
                  {jailTimeRemaining !== null ? formatDuration(jailTimeRemaining) : '---'}
                </p>
              </div>

              <div className={`flex items-center justify-center rounded-2xl border px-5 py-3 ${getStatusBadge(jailRecord?.status || 'jailed')}`}>
                <Lock className="mr-2 h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-[0.16em]">{jailRecord?.status || 'Active'}</span>
              </div>
            </div>
          </div>
        </header>

        {tcnnLive && isTcnnPlaying && (
          <div className="border-b border-zinc-800 bg-zinc-950/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <Radio className="h-4 w-4 text-red-300" />
                <span className="font-black uppercase tracking-wider text-red-300">TCNN Live</span>
                <span className="truncate text-zinc-300">{tcnnLive.title}</span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setIsTcnnPlaying(!isTcnnPlaying)} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 hover:bg-zinc-800">
                  {isTcnnPlaying ? <X className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button onClick={() => navigate('/tcnn/dashboard')} className="text-sm font-bold text-red-300 hover:text-red-200">
                  View <ChevronRight className="inline h-4 w-4" />
                </button>
              </div>
            </div>

            {tcnnLive.hls_url && (
              <div className="h-36 overflow-hidden rounded-xl border border-zinc-800 bg-black">
                <video ref={videoRef} className="h-full w-full object-cover" controls={false} autoPlay muted playsInline src={tcnnLive.hls_url} />
              </div>
            )}
          </div>
        )}

        <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-3">
          <aside className="space-y-4">
            <section className={`${cellPanel} p-5`}>
              <SectionTitle icon={Scale} title="Legal Summary" subtitle="Current arrest and sentence details" tone="red" />

              {loadingData ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 w-3/4 rounded bg-zinc-800" />
                  <div className="h-4 w-1/2 rounded bg-zinc-800" />
                  <div className="h-4 w-2/3 rounded bg-zinc-800" />
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {[
                    ['Charge', jailRecord?.reason || 'Pending'],
                    ['Arrested By', jailRecord?.arrested_by || 'Troll Officers'],
                    ['Arrest Date', jailRecord?.created_at ? new Date(jailRecord.created_at).toLocaleDateString() : '-'],
                    ['Sentence', `${jailRecord?.sentence_days || 0} days`],
                    ['Release Date', releaseTime ? new Date(releaseTime).toLocaleString() : 'Processing...'],
                    ['Bail Amount', `${jailRecord?.bond_amount || 0} TC`],
                    ['Bail Status', hasBail ? 'Paid' : 'Not Paid'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
                      <span className="text-zinc-500">{label}</span>
                      <span className="text-right font-semibold text-zinc-100">{value}</span>
                    </div>
                  ))}

                  {courtCase && (
                    <>
                      <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
                        <span className="text-zinc-500">Case #</span>
                        <span className="font-mono text-red-300">{courtCase.case_number}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-2">
                        <span className="text-zinc-500">Court Status</span>
                        <span className={`rounded border px-2 py-0.5 text-xs ${getCaseStatusBadge(courtCase.status)}`}>
                          {courtCase.status}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Court Date</span>
                        <span className="text-right text-zinc-100">
                          {courtCase.court_date ? new Date(courtCase.court_date).toLocaleString() : 'Not Scheduled'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className={`${warningPanel} p-5`}>
              <SectionTitle icon={ShieldAlert} title="Restrictions" subtitle="Active inmate limitations" tone="yellow" />

              <ul className="space-y-2 text-sm text-zinc-300">
                {['Cannot go live', 'Cannot join lives/battles', 'Cannot gift', 'Cannot use auctions', 'Cannot post freely'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-400" />
                    {item}
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  Legal communication allowed
                </li>
              </ul>
            </section>

            <section className={`${cellPanel} p-5`}>
              <SectionTitle icon={Gavel} title="Legal Actions" subtitle="Bail, attorney, and court access" tone="blue" />

              <div className="space-y-2">
                {(jailRecord?.bond_amount || 0) > 0 && !hasBail && (
                  <button
                    onClick={handlePayBail}
                    disabled={postingBail || (profile?.troll_coins || 0) < (jailRecord?.bond_amount || 0)}
                    className={`${greenButton} flex w-full items-center justify-center gap-2`}
                  >
                    <DollarSign className="h-4 w-4" />
                    Pay Bail ({jailRecord?.bond_amount} TC)
                  </button>
                )}

                {!attorneyCase && (
                  <button onClick={handleRequestAttorney} disabled={requestingAttorney} className={`${blueButton} flex w-full items-center justify-center gap-2`}>
                    <User className="h-4 w-4" />
                    Request Attorney
                  </button>
                )}

                {courtCase && (
                  <button onClick={() => navigate('/troll-court')} className={`${dangerButton} flex w-full items-center justify-center gap-2`}>
                    <Calendar className="h-4 w-4" />
                    View Court Docket
                  </button>
                )}
              </div>
            </section>
          </aside>

          <section className="space-y-4 lg:col-span-2">
            <div className={`${cellPanel} p-5`}>
              <SectionTitle icon={FileText} title="Court Case" subtitle="Official court record and case activity" tone="gray" />

              {courtCase ? (
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <InfoRow label="Case Number" value={courtCase.case_number} mono />
                  <InfoRow label="Title" value={courtCase.title} />
                  <InfoRow label="Reason" value={courtCase.reason} />
                  <InfoRow label="Status" value={courtCase.status.replace('_', ' ')} badge={getCaseStatusBadge(courtCase.status)} />
                  <InfoRow label="Filing Date" value={courtCase.filing_date ? new Date(courtCase.filing_date).toLocaleDateString() : '-'} />
                  <InfoRow label="Court Date" value={courtCase.court_date ? new Date(courtCase.court_date).toLocaleString() : 'Not scheduled'} />
                  <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-black/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Description</p>
                    <p className="mt-2 text-zinc-200">{courtCase.description || 'No description'}</p>
                  </div>
                  {courtCase.judgment && (
                    <div className="md:col-span-2 rounded-xl border border-yellow-700/50 bg-yellow-950/20 p-4">
                      <p className="font-bold text-yellow-300">Judgment</p>
                      <p className="mt-1 text-zinc-100">{courtCase.judgment}</p>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyCell icon={FileText} title="No court case filed" body="Cases are typically filed within 48 hours of arrest." />
              )}
            </div>

            <div className={`${cellPanel} p-5`}>
              <SectionTitle icon={Handshake} title="Attorney" subtitle="Defense request and attorney assignment" tone="blue" />

              {attorneyCase ? (
                attorneyCase.status === 'open' ? (
                  <EmptyCell icon={Clock} title="Attorney request submitted" body="Waiting for an attorney to take your case." tone="yellow" />
                ) : attorneyProfile ? (
                  <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-black/40 p-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-700/40 bg-zinc-900">
                      {attorneyProfile.avatar_url ? (
                        <img src={attorneyProfile.avatar_url} alt={attorneyProfile.username} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-cyan-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-black text-zinc-100">{attorneyProfile.username}</p>
                      <p className="text-sm capitalize text-zinc-500">{attorneyCase.status}</p>
                      {attorneyCase.case_details?.notes && <p className="mt-2 text-sm text-zinc-400">{attorneyCase.case_details.notes}</p>}
                    </div>
                  </div>
                ) : (
                  <EmptyCell icon={User} title="No attorney assigned" body="Request an attorney for defense support." action={handleRequestAttorney} />
                )
              ) : (
                <EmptyCell icon={User} title="No attorney assigned" body="Request an attorney for defense support." action={handleRequestAttorney} />
              )}
            </div>

            <div className={`${cellPanel} flex max-h-[430px] flex-col overflow-hidden`}>
              <div className="border-b border-zinc-800 p-5">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle icon={MessageSquare} title="Inmate Communication" subtitle="Monitored legal messaging" tone="blue" />
                  <span className="rounded-full border border-zinc-700 bg-black/40 px-3 py-1 text-xs font-bold text-zinc-400">
                    {MESSAGE_COST} TC / message
                  </span>
                </div>
              </div>

              <div className="max-h-[250px] flex-1 space-y-3 overflow-y-auto p-5">
                {messages.length === 0 ? (
                  <EmptyCell icon={MessageSquare} title="No messages yet" body="Contact admin, lead officer, or assigned attorney." />
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl border p-3 ${
                        msg.sender_id === user?.id
                          ? 'ml-8 border-cyan-800/50 bg-cyan-950/20'
                          : 'mr-8 border-zinc-800 bg-black/40'
                      }`}
                    >
                      <p className="mb-1 text-xs font-bold text-zinc-500">{msg.sender_username}</p>
                      <p className="text-sm text-zinc-100">{msg.message}</p>
                      <p className="mt-1 text-xs text-zinc-700">{new Date(msg.created_at).toLocaleTimeString()}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-zinc-800 bg-black/50 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message approved contacts..."
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-600"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className={`${blueButton} px-4`}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  Messages are monitored. Approved legal communication only.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">{label}</p>
      {badge ? (
        <span className={`mt-2 inline-flex rounded border px-2 py-1 text-xs font-bold uppercase ${badge}`}>{value}</span>
      ) : (
        <p className={`mt-2 text-zinc-100 ${mono ? 'font-mono text-red-300' : ''}`}>{value}</p>
      )}
    </div>
  );
}

function EmptyCell({
  icon: Icon,
  title,
  body,
  tone = 'gray',
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  tone?: 'gray' | 'yellow';
  action?: () => void;
}) {
  return (
    <div className={`rounded-xl border p-8 text-center ${tone === 'yellow' ? 'border-yellow-800/50 bg-yellow-950/20' : 'border-zinc-800 bg-black/40'}`}>
      <Icon className={`mx-auto mb-3 h-12 w-12 ${tone === 'yellow' ? 'text-yellow-400' : 'text-zinc-700'}`} />
      <p className="font-black text-zinc-200">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{body}</p>
      {action && (
        <button onClick={action} className={`${blueButton} mt-4`}>
          Request Attorney
        </button>
      )}
    </div>
  );
}
