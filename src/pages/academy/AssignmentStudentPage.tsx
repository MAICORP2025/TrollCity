import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getCourseBySlug, getCourseAssignments, getAssignmentSubmissions, submitAssignment, getStudentEnrollments } from '@/services/academyService';
import type { AcademyCourse, AcademyAssignment, AcademySubmission, AcademyEnrollment } from '@/types/academy';
import {
  ChevronLeft, FileText, Clock, CheckCircle, AlertCircle, Upload, Send,
  Loader2, BookOpen, Award, Calendar, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AssignmentStudentPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuthStore();
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [assignments, setAssignments] = useState<AcademyAssignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, AcademySubmission>>({});
  const [enrollment, setEnrollment] = useState<AcademyEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'graded' | 'late'>('all');

  useEffect(() => {
    const fetchData = async () => {
      if (!slug || !user?.id) return;
      try {
        const courseData = await getCourseBySlug(slug);
        if (!courseData) { navigate('/academy/courses'); return; }
        setCourse(courseData);

        const enrollmentsData = await getStudentEnrollments(user.id);
        const activeEnrollment = enrollmentsData.find(e => e.course_id === courseData.id && e.status === 'accepted');
        setEnrollment(activeEnrollment || null);

        const assignmentsData = await getCourseAssignments(courseData.id);
        setAssignments(assignmentsData);

        for (const assignment of assignmentsData) {
          const subs = await getAssignmentSubmissions(assignment.id);
          const mySub = subs.find(s => s.student_id === user.id);
          if (mySub) setSubmissions(prev => ({ ...prev, [assignment.id]: mySub }));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [slug, user?.id]);

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getAssignmentStatus = (assignment: AcademyAssignment) => {
    const sub = submissions[assignment.id];
    if (sub) {
      if (sub.status === 'graded') return 'graded';
      if (sub.status === 'returned') return 'returned';
      return 'submitted';
    }
    if (isOverdue(assignment.due_date)) return 'late';
    return 'pending';
  };

  const filteredAssignments = assignments.filter(a => {
    if (activeTab === 'all') return true;
    return getAssignmentStatus(a) === activeTab;
  });

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>;
  if (!course) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate(`/academy/course/${slug}`)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Course
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{course.name} — Assignments</h1>
            <p className="text-xs text-slate-400">{assignments.length} assignments</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {([
          { id: 'all' as const, label: 'All', count: assignments.length },
          { id: 'pending' as const, label: 'Pending', count: assignments.filter(a => getAssignmentStatus(a) === 'pending').length },
          { id: 'graded' as const, label: 'Graded', count: assignments.filter(a => getAssignmentStatus(a) === 'graded').length },
          { id: 'late' as const, label: 'Overdue', count: assignments.filter(a => getAssignmentStatus(a) === 'late').length },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === tab.id ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'}`}>
            {tab.label} <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {filteredAssignments.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center`}>
          <FileText className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No assignments in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map(assignment => {
            const status = getAssignmentStatus(assignment);
            const sub = submissions[assignment.id];
            return (
              <div key={assignment.id} className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{assignment.assignment_type === 'homework' ? '📝' : assignment.assignment_type === 'project' ? '🔬' : assignment.assignment_type === 'essay' ? '✍️' : assignment.assignment_type === 'practical' ? '🔧' : '📊'}</span>
                      <h3 className="text-sm font-bold text-white">{assignment.title}</h3>
                    </div>
                    {assignment.description && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{assignment.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {assignment.max_points} pts</span>
                      {assignment.due_date && (
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                      )}
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {assignment.assignment_type}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {status === 'graded' && sub ? (
                      <div className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-center">
                        <p className="text-lg font-black text-emerald-400">{sub.score}/{sub.max_points}</p>
                        <p className="text-[9px] text-emerald-300">Graded</p>
                      </div>
                    ) : status === 'submitted' ? (
                      <span className="rounded-full bg-blue-500/20 px-3 py-1 text-[10px] font-bold text-blue-300">Submitted</span>
                    ) : status === 'late' ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-300">Overdue</span>
                    ) : (
                      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-[10px] font-bold text-yellow-300">Pending</span>
                    )}
                  </div>
                </div>
                {sub?.feedback && (
                  <div className="mt-3 rounded-lg bg-white/[0.03] p-3">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">Teacher Feedback:</p>
                    <p className="text-xs text-slate-300">{sub.feedback}</p>
                  </div>
                )}
                {(status === 'pending' || status === 'late') && enrollment && (
                  <div className="mt-3">
                    <StudentSubmissionForm assignment={assignment} enrollmentId={enrollment.id} onSubmit={(newSub) => {
                      setSubmissions(prev => ({ ...prev, [assignment.id]: newSub }));
                      toast.success('Assignment submitted!');
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentSubmissionForm({ assignment, enrollmentId, onSubmit }: { assignment: AcademyAssignment; enrollmentId: string; onSubmit: (sub: AcademySubmission) => void }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) { toast.error('Please enter your submission'); return; }
    setSubmitting(true);
    try {
      const isLate = assignment.due_date && new Date(assignment.due_date) < new Date();
      const sub = await submitAssignment({
        assignment_id: assignment.id,
        student_id: user!.id,
        content,
        submission_type: 'text',
        status: isLate ? 'late' : 'submitted',
        max_points: assignment.max_points,
      });
      onSubmit(sub);
    } catch (err: any) { toast.error(err.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="flex items-center gap-1 rounded-lg bg-purple-500/20 px-3 py-1.5 text-[10px] font-bold text-purple-300 hover:bg-purple-500/30">
        <Upload className="h-3 w-3" /> Submit Assignment
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-purple-400/20 bg-purple-500/[0.05] p-3 space-y-2">
      <textarea rows={4} value={content} onChange={e => setContent(e.target.value)}
        placeholder="Enter your submission..."
        className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none focus:border-purple-400/50" />
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={submitting}
          className="flex items-center gap-1 rounded-lg bg-purple-500 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Submit
        </button>
        <button onClick={() => setExpanded(false)} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-slate-400">Cancel</button>
      </div>
    </div>
  );
}
