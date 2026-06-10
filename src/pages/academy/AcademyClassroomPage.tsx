import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getCourseSessions, getStudentEnrollments, getCourseClassroomByCourseId, markAttendance, getAttendancePercentage } from '@/services/academyService';
import type { AcademyEnrollment, AcademySession, AcademyClassroom, AcademyAttendance } from '@/types/academy';
import {
  ChevronLeft, BookOpen, Calendar, Users, Shield, Play, Square,
  MessageSquare, CheckCircle, Clock, XCircle, AlertCircle, Send,
  UserCheck, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export default function AcademyClassroomPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const { user } = useAuthStore();
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [classroom, setClassroom] = useState<AcademyClassroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<AcademySession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [attendancePct, setAttendancePct] = useState(100);
  const [activeTab, setActiveTab] = useState<'sessions' | 'chat' | 'attendance'>('sessions');

  const selectedEnrollment = courseId
    ? enrollments.find(e => e.course_id === courseId || e.course_slug === courseId)
    : enrollments[0];

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const studentEnrollments = await getStudentEnrollments(user.id);
        setEnrollments(studentEnrollments);
        const selected = courseId
          ? studentEnrollments.find(e => e.course_id === courseId || e.course_slug === courseId)
          : studentEnrollments[0];

        if (selected) {
          const [courseSessions, courseClassroom] = await Promise.all([
            getCourseSessions(selected.course_id),
            getCourseClassroomByCourseId(selected.course_id),
          ]);
          setSessions(courseSessions);
          setClassroom(courseClassroom);

          const liveSession = courseSessions.find(s => s.status === 'live');
          if (liveSession) {
            setActiveSession(liveSession);
            setIsLive(true);
            setActiveTab('chat');
          }

          const pct = await getAttendancePercentage(user.id, selected.course_id);
          setAttendancePct(pct);
        }
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user?.id, courseId]);

  const handleCheckIn = async () => {
    if (!activeSession || !selectedEnrollment || !user?.id) return;
    try {
      await markAttendance(activeSession.id, user.id, selectedEnrollment.course_id, 'present');
      setAttendanceMarked(true);
      toast.success('Checked in!');
    } catch { toast.error('Already checked in'); }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      user_id: user!.id,
      username: user!.user_metadata?.display_name || 'Student',
      content: chatInput,
      created_at: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
  };

  if (!user) {
    return <div className="mx-auto max-w-3xl p-4 text-center text-slate-300"><p className="text-sm">Sign in to access your classroom.</p></div>;
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /></div>;
  }

  if (!selectedEnrollment) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className={`${glass} rounded-3xl p-8 text-center`}>
          <Shield className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-white">No active classroom found</h2>
          <p className="mt-2 text-sm text-slate-400">You are not enrolled in a course with a classroom yet.</p>
          <button onClick={() => navigate('/academy/courses')} className="mt-4 rounded-2xl bg-cyan-500 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-cyan-400">Browse Courses</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <section className={`${glass} rounded-2xl p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-emerald-400" />
            <div>
              <h1 className="text-xl font-black text-white">{selectedEnrollment.course_name || 'Classroom'}</h1>
              <p className="text-xs text-slate-400">Teacher: {selectedEnrollment.teacher_name || 'TBA'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLive && <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE</span>}
            <button onClick={() => navigate(`/academy/course/${selectedEnrollment.course_slug || selectedEnrollment.course_id}`)}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-bold text-slate-300">View Course</button>
          </div>
        </div>
      </section>

      {isLive && (
        <div className="flex gap-2 border-b border-white/10 pb-2">
          {([
            { id: 'chat' as const, label: 'Classroom Chat', icon: MessageSquare },
            { id: 'attendance' as const, label: 'Attendance', icon: UserCheck },
            { id: 'sessions' as const, label: 'Schedule', icon: Calendar },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === tab.id ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'}`}>
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'chat' && isLive && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <section className={`${glass} rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Play className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-black text-white">Live Classroom — {activeSession?.title}</h2>
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-6 text-center mb-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 mb-3">
                  <Play className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-white">Class in Session</p>
                <p className="text-xs text-slate-400 mt-1">{activeSession?.description || 'Join the discussion below'}</p>
                {!attendanceMarked && (
                  <button onClick={handleCheckIn} className="mt-3 flex items-center gap-1 mx-auto rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white">
                    <CheckCircle className="h-3.5 w-3.5" /> Check In
                  </button>
                )}
                {attendanceMarked && (
                  <p className="mt-3 text-xs font-bold text-emerald-300"><CheckCircle className="inline h-3 w-3 mr-1" /> Checked in</p>
                )}
              </div>
              <div className="h-64 overflow-y-auto rounded-xl bg-white/[0.02] p-3 space-y-2 mb-3">
                {chatMessages.length === 0 && <p className="text-center text-xs text-slate-500 py-8">No messages yet. Say hello!</p>}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.user_id === user?.id ? 'justify-end' : ''}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${msg.user_id === user?.id ? 'bg-emerald-500/20' : 'bg-white/[0.06]'}`}>
                      <p className="text-[10px] font-bold text-slate-400">{msg.username}</p>
                      <p className="text-xs text-white">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50" />
                <button onClick={handleSendChat} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>
          </div>
          <div className="space-y-4">
            <section className={`${glass} rounded-2xl p-4`}>
              <h3 className="text-xs font-black text-white mb-2">Attendance</h3>
              <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                <p className="text-2xl font-black text-cyan-400">{attendancePct}%</p>
                <p className="text-[9px] text-slate-400">Your attendance</p>
              </div>
            </section>
            <section className={`${glass} rounded-2xl p-4`}>
              <h3 className="text-xs font-black text-white mb-2">Session Info</h3>
              <div className="space-y-2 text-xs text-slate-400">
                <p><Clock className="inline h-3 w-3 mr-1" /> {activeSession?.start_time} - {activeSession?.end_time}</p>
                <p><Calendar className="inline h-3 w-3 mr-1" /> {activeSession?.session_date}</p>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Your Attendance</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <div className="rounded-xl bg-white/[0.04] p-3 text-center"><CheckCircle className="mx-auto h-5 w-5 text-emerald-400" /><p className="mt-1 text-lg font-black text-white">{attendancePct}%</p><p className="text-[9px] text-slate-400">Overall</p></div>
          </div>
          <div className="space-y-2">
            {sessions.map(session => (
              <div key={session.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                <div>
                  <p className="text-xs font-bold text-white">{session.title}</p>
                  <p className="text-[9px] text-slate-500">{session.session_date}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${session.status === 'live' ? 'bg-red-500/20 text-red-300' : session.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'sessions' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Class Schedule</h2>
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">No sessions scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, i) => (
                <div key={session.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-500/10">
                    <span className="text-[9px] font-bold text-emerald-400">Session</span>
                    <span className="text-sm font-black text-white">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white">{session.title}</p>
                    <p className="text-[10px] text-slate-400">{new Date(session.session_date).toLocaleDateString()} • {session.start_time} - {session.end_time}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold ${session.status === 'live' ? 'bg-red-500/20 text-red-300' : session.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                    {session.status === 'live' ? '● LIVE' : session.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {enrollments.length > 1 && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-3 text-sm font-black text-white">Other Enrollments</h2>
          <div className="space-y-2">
            {enrollments.map(enrollment => (
              <button key={enrollment.id} onClick={() => navigate(`/academy/classroom/${enrollment.course_id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-cyan-400/30 hover:bg-white/[0.06]">
                <div>
                  <p className="text-sm font-black text-white">{enrollment.course_name}</p>
                  <p className="text-xs text-slate-400">Teacher: {enrollment.teacher_name || 'TBA'}</p>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
