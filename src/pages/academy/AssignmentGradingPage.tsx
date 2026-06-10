import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getTeacherByUserId, getTeacherCourses, getCourseAssignments, getAssignmentSubmissions, gradeSubmission } from '@/services/academyService';
import type { AcademyTeacher, AcademyCourse, AcademyAssignment, AcademySubmission } from '@/types/academy';
import {
  ChevronLeft, FileText, Users, CheckCircle, Clock, AlertTriangle,
  Save, Loader2, Award, Filter, Search,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AssignmentGradingPage() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [assignment, setAssignment] = useState<AcademyAssignment | null>(null);
  const [submissions, setSubmissions] = useState<AcademySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'graded' | 'late'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const init = async () => {
      if (!user?.id || !assignmentId) return;
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);

        const { data: assignData } = await supabase.from('academy_assignments').select('*').eq('id', assignmentId).single();
        setAssignment(assignData);

        const subs = await getAssignmentSubmissions(assignmentId);
        setSubmissions(subs);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [user?.id, assignmentId]);

  const handleGrade = async (subId: string, score: number, feedback: string) => {
    setGrading(subId);
    try {
      await gradeSubmission(subId, score, feedback, user!.id);
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, score, feedback, status: 'graded' as const, graded_by: user!.id, graded_at: new Date().toISOString() } : s));
      toast.success('Graded!');
    } catch { toast.error('Failed to grade'); }
    setGrading(null);
  };

  const handleBulkGrade = async (score: number) => {
    const ungraded = submissions.filter(s => s.status === 'submitted' || s.status === 'late');
    for (const sub of ungraded) {
      await handleGrade(sub.id, score, 'Bulk graded');
    }
    toast.success(`Graded ${ungraded.length} submissions`);
  };

  const filtered = submissions.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (searchQuery && !s.student_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;
  if (!teacher || !assignment) return null;

  const stats = {
    total: submissions.length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    graded: submissions.filter(s => s.status === 'graded').length,
    late: submissions.filter(s => s.status === 'late').length,
    avgScore: submissions.filter(s => s.score !== null).length > 0
      ? Math.round(submissions.filter(s => s.score !== null).reduce((sum, s) => sum + (s.score || 0), 0) / submissions.filter(s => s.score !== null).length)
      : 0,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{assignment.title}</h1>
              <p className="text-xs text-slate-400">{assignment.assignment_type} • {assignment.max_points} pts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleBulkGrade(assignment.max_points)} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30">
              <CheckCircle className="inline h-3 w-3 mr-1" /> All 100%
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className={`${glass} rounded-xl p-3 text-center`}><Users className="mx-auto h-4 w-4 text-blue-400" /><p className="mt-1 text-lg font-black text-white">{stats.total}</p><p className="text-[9px] text-slate-400">Total</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><Clock className="mx-auto h-4 w-4 text-yellow-400" /><p className="mt-1 text-lg font-black text-white">{stats.submitted}</p><p className="text-[9px] text-slate-400">Pending</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><CheckCircle className="mx-auto h-4 w-4 text-emerald-400" /><p className="mt-1 text-lg font-black text-white">{stats.graded}</p><p className="text-[9px] text-slate-400">Graded</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><AlertTriangle className="mx-auto h-4 w-4 text-red-400" /><p className="mt-1 text-lg font-black text-white">{stats.late}</p><p className="text-[9px] text-slate-400">Late</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><Award className="mx-auto h-4 w-4 text-purple-400" /><p className="mt-1 text-lg font-black text-white">{stats.avgScore}</p><p className="text-[9px] text-slate-400">Avg Score</p></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {(['all', 'submitted', 'graded', 'late'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold transition ${filter === f ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search students..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.05] py-1.5 pl-7 pr-3 text-xs text-white outline-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center`}>
          <FileText className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No submissions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sub => (
            <SubmissionCard key={sub.id} submission={sub} maxPoints={assignment.max_points} grading={grading === sub.id}
              onGrade={(score, feedback) => handleGrade(sub.id, score, feedback)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ submission, maxPoints, grading, onGrade }: { submission: AcademySubmission; maxPoints: number; grading: boolean; onGrade: (score: number, feedback: string) => void }) {
  const [score, setScore] = useState<string>(submission.score?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback || '');

  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-xs font-black text-purple-300">
              {(submission.student_name || 'S')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-white">{submission.student_name || 'Student'}</p>
              <p className="text-[9px] text-slate-500">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
            </div>
            {submission.status === 'late' && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[8px] font-bold text-red-300">LATE</span>}
          </div>
          {submission.content && (
            <div className="mt-2 rounded-lg bg-white/[0.03] p-3">
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{submission.content}</p>
            </div>
          )}
          {submission.status === 'graded' && submission.feedback && (
            <div className="mt-2 rounded-lg bg-emerald-500/10 p-2">
              <p className="text-[10px] font-bold text-emerald-300">Feedback: {submission.feedback}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {submission.status === 'graded' ? (
            <div className="text-right">
              <p className="text-lg font-black text-emerald-400">{submission.score}/{maxPoints}</p>
              <p className="text-[9px] text-emerald-300">Graded</p>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <input type="number" min={0} max={maxPoints} value={score} onChange={e => setScore(e.target.value)}
                className="w-16 rounded border border-white/10 bg-[#050710] px-2 py-1 text-xs text-white text-center outline-none" />
              <span className="text-xs text-slate-400">/ {maxPoints}</span>
            </div>
          )}
        </div>
      </div>
      {submission.status !== 'graded' && (
        <div className="mt-3 flex items-end gap-2">
          <input type="text" placeholder="Feedback (optional)..." value={feedback} onChange={e => setFeedback(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white outline-none" />
          <button onClick={() => onGrade(parseInt(score) || 0, feedback)} disabled={grading}
            className="flex items-center gap-1 rounded-lg bg-purple-500 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
            {grading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Grade
          </button>
        </div>
      )}
    </div>
  );
}
