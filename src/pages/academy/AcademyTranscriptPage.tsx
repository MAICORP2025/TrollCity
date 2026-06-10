import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { getStudentEnrollments } from '@/services/academyService';
import type { AcademyEnrollment } from '@/types/academy';
import { FileText, ChevronRight } from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyTranscriptPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const items = await getStudentEnrollments(user.id);
        setEnrollments(items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  if (!user) {
    return <div className="mx-auto max-w-3xl p-4 text-center text-slate-300">Please sign in to view your transcript.</div>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <section className={`${glass} rounded-3xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-black text-white">Academic Transcript</h1>
                <p className="text-sm text-slate-400">Review your courses, grades, and completion history.</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/academy/coins')} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]">
            View Coins
          </button>
        </div>
      </section>

      {enrollments.length === 0 ? (
        <div className={`${glass} rounded-3xl p-8 text-center text-slate-400`}>
          <p className="text-sm">No transcript records yet. Enroll in Academy courses to begin earning grades.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {enrollments.map((enrollment) => (
            <div key={enrollment.id} className={`${glass} rounded-3xl p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">{enrollment.course_name}</p>
                  <p className="text-xs text-slate-400">Status: {enrollment.status}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>Final Grade: {enrollment.final_grade || 'N/A'}</p>
                  <p>{enrollment.final_percentage !== null ? `${enrollment.final_percentage}%` : 'No grade yet'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button onClick={() => navigate(`/academy/classroom/${enrollment.course_id}`)} className="rounded-2xl bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10">
                  Enter Classroom
                </button>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
