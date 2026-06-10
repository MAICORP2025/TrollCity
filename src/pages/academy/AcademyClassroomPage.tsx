import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { getCourseSessions, getStudentEnrollments, getCourseClassroomByCourseId } from '@/services/academyService';
import type { AcademyEnrollment, AcademySession, AcademyClassroom } from '@/types/academy';
import { BookOpen, Calendar, Users, Shield, ChevronRight } from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyClassroomPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const { user } = useAuthStore();
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [classroom, setClassroom] = useState<AcademyClassroom | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const studentEnrollments = await getStudentEnrollments(user.id);
        setEnrollments(studentEnrollments);
        const selected = courseId
          ? studentEnrollments.find((enrollment) => enrollment.course_id === courseId || enrollment.course_slug === courseId)
          : studentEnrollments[0];

        if (selected) {
          const [courseSessions, courseClassroom] = await Promise.all([
            getCourseSessions(selected.course_id),
            getCourseClassroomByCourseId(selected.course_id),
          ]);
          setSessions(courseSessions);
          setClassroom(courseClassroom);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id, courseId]);

  const selectedEnrollment = courseId
    ? enrollments.find((enrollment) => enrollment.course_id === courseId || enrollment.course_slug === courseId)
    : enrollments[0];

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl p-4 text-center text-slate-300">
        <p className="text-sm">Sign in to access your classroom.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!selectedEnrollment) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className={`${glass} rounded-3xl p-8 text-center`}>
          <Shield className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-white">No active classroom found</h2>
          <p className="mt-2 text-sm text-slate-400">You are not enrolled in a course with a classroom yet.</p>
          <button onClick={() => navigate('/academy/courses')} className="mt-4 rounded-2xl bg-cyan-500 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-cyan-400">
            Browse Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <section className={`${glass} rounded-3xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-emerald-400" />
              <div>
                <h1 className="text-2xl font-black text-white">{selectedEnrollment.course_name || 'Classroom'}</h1>
                <p className="text-sm text-slate-400">Teacher: {selectedEnrollment.teacher_name || 'TBA'}</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate(`/academy/course/${selectedEnrollment.course_slug || selectedEnrollment.course_id}`)} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]">
            View Course
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${glass} rounded-3xl p-5 lg:col-span-2`}>
          <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
            <Calendar className="h-4 w-4 text-cyan-400" />
            Classroom Schedule
          </div>
          {sessions.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-slate-400">No sessions are scheduled yet for this class.</div>
          ) : (
            <div className="mt-5 space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{session.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{new Date(session.session_date).toLocaleDateString()} · {session.start_time} - {session.end_time}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${session.status === 'live' ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-slate-300'}`}>
                      {session.status.toUpperCase()}
                    </span>
                  </div>
                  {session.description && <p className="mt-3 text-xs text-slate-400">{session.description}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${glass} rounded-3xl p-5`}>
          <h2 className="text-sm font-black text-white">Classroom Details</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-3xl bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Course</p>
              <p className="mt-2 text-sm font-black text-white">{selectedEnrollment.course_name}</p>
            </div>
            <div className="rounded-3xl bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Teacher</p>
              <p className="mt-2 text-sm font-black text-white">{selectedEnrollment.teacher_name || 'TBA'}</p>
            </div>
            <div className="rounded-3xl bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Classroom ID</p>
              <p className="mt-2 text-sm font-black text-white">{classroom?.id || 'Not assigned'}</p>
            </div>
            <button className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-400">
              Join Classroom
            </button>
          </div>
        </section>
      </div>

      {enrollments.length > 1 && (
        <section className={`${glass} rounded-3xl p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Other Enrollments</div>
            <span className="text-xs text-slate-500">Select a different class</span>
          </div>
          <div className="mt-4 space-y-3">
            {enrollments.map((enrollment) => (
              <button
                key={enrollment.id}
                onClick={() => navigate(`/academy/classroom/${enrollment.course_id}`)}
                className="flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-cyan-400/30 hover:bg-white/[0.06]"
              >
                <div>
                  <p className="text-sm font-black text-white">{enrollment.course_name}</p>
                  <p className="mt-1 text-xs text-slate-400">Teacher: {enrollment.teacher_name || 'TBA'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
