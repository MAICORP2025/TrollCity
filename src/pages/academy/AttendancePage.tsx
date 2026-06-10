import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getTeacherByUserId, getCourseSessions, getCourseEnrollments, markAttendance, getStudentAttendance, getAttendancePercentage } from '@/services/academyService';
import type { AcademyTeacher, AcademySession, AcademyEnrollment, AcademyAttendance, AttendanceStatus } from '@/types/academy';
import {
  ChevronLeft, Calendar, Users, CheckCircle, Clock, XCircle, AlertCircle,
  Save, Loader2, UserCheck, UserX,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Present', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'bg-emerald-500' },
  { value: 'late', label: 'Late', icon: <Clock className="h-3.5 w-3.5" />, color: 'bg-yellow-500' },
  { value: 'absent', label: 'Absent', icon: <XCircle className="h-3.5 w-3.5" />, color: 'bg-red-500' },
  { value: 'excused', label: 'Excused', icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'bg-blue-500' },
];

export default function AttendancePage() {
  const navigate = useNavigate();
  const { courseId, sessionId } = useParams();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [existingAttendance, setExistingAttendance] = useState<AcademyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>(sessionId || '');
  const [bulkAction, setBulkAction] = useState<AttendanceStatus | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user?.id || !courseId) return;
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);

        const [sessionsData, enrollmentsData] = await Promise.all([
          getCourseSessions(courseId),
          getCourseEnrollments(courseId),
        ]);
        setSessions(sessionsData);
        setEnrollments(enrollmentsData);

        if (!selectedSession && sessionsData.length > 0) {
          setSelectedSession(sessionsData[sessionsData.length - 1].id);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [user?.id, courseId]);

  useEffect(() => {
    if (!selectedSession) return;
    const fetchAttendance = async () => {
      const { data } = await supabase.from('academy_attendance').select('*').eq('session_id', selectedSession);
      if (data) {
        setExistingAttendance(data);
        const map: Record<string, AttendanceStatus> = {};
        data.forEach((a: AcademyAttendance) => { map[a.student_id] = a.status; });
        setAttendance(map);
      }
    };
    fetchAttendance();
  }, [selectedSession]);

  const handleMark = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    const map: Record<string, AttendanceStatus> = {};
    enrollments.forEach(e => { map[e.student_id] = status; });
    setAttendance(map);
  };

  const handleSave = async () => {
    if (!selectedSession || !courseId) return;
    setSaving(true);
    try {
      for (const [studentId, status] of Object.entries(attendance)) {
        await markAttendance(selectedSession, studentId, courseId, status);
      }
      toast.success('Attendance saved!');
      const { data } = await supabase.from('academy_attendance').select('*').eq('session_id', selectedSession);
      if (data) setExistingAttendance(data);
    } catch { toast.error('Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const session = sessions.find(s => s.id === selectedSession);
  const stats = {
    present: Object.values(attendance).filter(s => s === 'present').length,
    late: Object.values(attendance).filter(s => s === 'late').length,
    absent: Object.values(attendance).filter(s => s === 'absent').length,
    excused: Object.values(attendance).filter(s => s === 'excused').length,
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" /></div>;
  if (!teacher) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
            <UserCheck className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">Attendance</h1>
            <p className="text-xs text-slate-400">{enrollments.length} enrolled students</p>
          </div>
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#050710] px-3 py-2 text-xs text-white outline-none appearance-none">
            <option value="">Select session...</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.title} — {s.session_date}</option>)}
          </select>
        </div>
      </section>

      {session && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${glass} rounded-xl p-3 text-center`}><CheckCircle className="mx-auto h-5 w-5 text-emerald-400" /><p className="mt-1 text-xl font-black text-white">{stats.present}</p><p className="text-[9px] text-slate-400">Present</p></div>
            <div className={`${glass} rounded-xl p-3 text-center`}><Clock className="mx-auto h-5 w-5 text-yellow-400" /><p className="mt-1 text-xl font-black text-white">{stats.late}</p><p className="text-[9px] text-slate-400">Late</p></div>
            <div className={`${glass} rounded-xl p-3 text-center`}><XCircle className="mx-auto h-5 w-5 text-red-400" /><p className="mt-1 text-xl font-black text-white">{stats.absent}</p><p className="text-[9px] text-slate-400">Absent</p></div>
            <div className={`${glass} rounded-xl p-3 text-center`}><AlertCircle className="mx-auto h-5 w-5 text-blue-400" /><p className="mt-1 text-xl font-black text-white">{stats.excused}</p><p className="text-[9px] text-slate-400">Excused</p></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-400 self-center">Bulk:</span>
            {ATTENDANCE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleBulkMark(opt.value)}
                className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/[0.1]">
                {opt.icon} All {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {enrollments.map(enrollment => (
              <div key={enrollment.id} className={`${glass} rounded-xl p-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-black text-cyan-300">
                      {(enrollment.student_name || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{enrollment.student_name || 'Student'}</p>
                      <p className="text-[9px] text-slate-500">{enrollment.student_id_number || enrollment.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {ATTENDANCE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => handleMark(enrollment.student_id, opt.value)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${attendance[enrollment.student_id] === opt.value ? `${opt.color} text-white` : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]'}`}>
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Attendance
            </button>
          </div>
        </>
      )}
    </div>
  );
}
