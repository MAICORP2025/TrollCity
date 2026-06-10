import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getStudentEnrollments, getCourseAssignments } from '@/services/academyService';
import type { AcademyAssignment } from '@/types/academy';
import {
  FileText, ChevronLeft, Clock, CheckCircle, AlertTriangle, BookOpen,
} from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AssignmentsListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState<(AcademyAssignment & { course_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;
      try {
        const enrollments = await getStudentEnrollments(user.id);
        const active = enrollments.filter(e => e.status === 'accepted');
        const allAssignments: (AcademyAssignment & { course_name?: string })[] = [];
        for (const enr of active) {
          const assigns = await getCourseAssignments(enr.course_id);
          assigns.forEach(a => allAssignments.push({ ...a, course_name: enr.course_name }));
        }
        allAssignments.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        setAssignments(allAssignments);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [user?.id]);

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate('/academy')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Academy
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">My Assignments</h1>
            <p className="text-sm text-slate-400">{assignments.length} assignments across all courses</p>
          </div>
        </div>
      </section>

      {assignments.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center`}>
          <BookOpen className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No assignments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <div key={a.id} className={`${glass} rounded-2xl p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{a.assignment_type === 'homework' ? '📝' : a.assignment_type === 'project' ? '🔬' : a.assignment_type === 'essay' ? '✍️' : a.assignment_type === 'practical' ? '🔧' : '📊'}</span>
                    <h3 className="text-sm font-bold text-white">{a.title}</h3>
                  </div>
                  {a.description && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{a.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {a.course_name || 'Course'}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {a.max_points} pts</span>
                    {a.due_date && (
                      <span className={`flex items-center gap-1 ${isOverdue(a.due_date) ? 'text-red-400' : 'text-amber-400'}`}>
                        <Clock className="h-3 w-3" /> Due {new Date(a.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {a.due_date && isOverdue(a.due_date) ? (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[8px] font-bold text-red-300">Overdue</span>
                  ) : (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[8px] font-bold text-blue-300">Active</span>
                  )}
                  <button onClick={() => navigate(`/academy/course/${a.course_name?.toLowerCase().replace(/\s+/g, '-') || ''}/assignments`)}
                    className="rounded-lg bg-purple-500/20 px-3 py-1 text-[9px] font-bold text-purple-300 hover:bg-purple-500/30">
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
