import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getLearningPathways, getStudentEnrollments, getPublishedCourses } from '@/services/academyService';
import type { AcademyLearningPathway, AcademyEnrollment, AcademyCourse } from '@/types/academy';
import {
  ChevronLeft, TrendingUp, BookOpen, Award, CheckCircle, Lock, ArrowRight,
  Users, Star, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function PathwayDetailPage() {
  const navigate = useNavigate();
  const { pathwayId } = useParams();
  const { user } = useAuthStore();
  const [pathway, setPathway] = useState<AcademyLearningPathway | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [userEnrollments, setUserEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!pathwayId || !user?.id) return;
      try {
        const pathways = await getLearningPathways();
        const pw = pathways.find(p => p.id === pathwayId);
        if (!pw) { navigate('/academy'); return; }
        setPathway(pw);

        if (pw.courses.length > 0) {
          const { data: coursesData } = await supabase
            .from('academy_courses')
            .select('*, teacher:academy_teachers(teacher_user:user_profiles(display_name))')
            .in('id', pw.courses)
            .eq('status', 'published');
          if (coursesData) {
            const ordered = pw.courses.map(id => coursesData.find(c => c.id === id)).filter(Boolean) as AcademyCourse[];
            setCourses(ordered);
          }
        }

        const { data: pathwayEnrollments } = await supabase
          .from('academy_pathway_enrollments')
          .select('*')
          .eq('student_id', user.id);
        const myEnrollment = pathwayEnrollments?.find((e: any) => e.pathway_id === pathwayId);
        setEnrollment(myEnrollment || null);

        const enrollments = await getStudentEnrollments(user.id);
        setUserEnrollments(enrollments);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [pathwayId, user?.id]);

  const handleEnroll = async () => {
    if (!pathwayId || !user?.id) return;
    setEnrolling(true);
    try {
      const { data, error } = await supabase
        .from('academy_pathway_enrollments')
        .insert([{ student_id: user.id, pathway_id: pathwayId }])
        .select()
        .single();
      if (error) throw error;
      setEnrollment(data);
      toast.success('Enrolled in pathway!');
    } catch (err: any) { toast.error(err.message || 'Failed to enroll'); }
    finally { setEnrolling(false); }
  };

  const getCourseStatus = (courseId: string) => {
    const enr = userEnrollments.find(e => e.course_id === courseId);
    if (!enr) return 'not_started';
    if (enr.status === 'completed') return 'completed';
    if (enr.status === 'accepted') return 'in_progress';
    return 'not_started';
  };

  const completedCount = courses.filter(c => getCourseStatus(c.id) === 'completed').length;
  const progressPct = courses.length > 0 ? Math.round((completedCount / courses.length) * 100) : 0;

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" /></div>;
  if (!pathway) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <button onClick={() => navigate('/academy')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Academy
      </button>

      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-3xl">
              {pathway.badge_icon || '🎓'}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{pathway.name}</h1>
              {pathway.description && <p className="mt-1 text-sm text-slate-400">{pathway.description}</p>}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {courses.length} courses</span>
                {enrollment && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {progressPct}% complete</span>}
              </div>
            </div>
          </div>
          {!enrollment ? (
            <button onClick={handleEnroll} disabled={enrolling}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Enroll in Pathway
            </button>
          ) : (
            <div className="rounded-xl bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">✓ Enrolled</div>
          )}
        </div>
        {enrollment && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Progress</span>
              <span className="font-bold text-white">{completedCount}/{courses.length} courses</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </section>

      <div className="space-y-3">
        {courses.map((course, idx) => {
          const status = getCourseStatus(course.id);
          const isLocked = idx > 0 && getCourseStatus(courses[idx - 1].id) !== 'completed' && !enrollment;
          return (
            <div key={course.id} className={`${glass} rounded-2xl p-4 ${isLocked ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${status === 'completed' ? 'bg-emerald-500/20' : status === 'in_progress' ? 'bg-blue-500/20' : 'bg-white/[0.06]'}`}>
                    {status === 'completed' ? <CheckCircle className="h-5 w-5 text-emerald-400" /> :
                     status === 'in_progress' ? <BookOpen className="h-5 w-5 text-blue-400" /> :
                     isLocked ? <Lock className="h-5 w-5 text-slate-500" /> :
                     <span className="text-sm font-bold text-slate-400">{idx + 1}</span>}
                  </div>
                  {idx < courses.length - 1 && <div className="mt-1 h-6 w-0.5 bg-white/10" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{course.name}</h3>
                    {status === 'completed' && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[8px] font-bold text-emerald-300">COMPLETED</span>}
                    {status === 'in_progress' && <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[8px] font-bold text-blue-300">IN PROGRESS</span>}
                  </div>
                  <p className="text-[10px] text-slate-400">{course.teacher_name || 'TBA'} • {course.difficulty_level} • {course.enrolled_count || 0} students</p>
                </div>
                <button onClick={() => !isLocked && navigate(`/academy/course/${course.slug}`)}
                  disabled={isLocked}
                  className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.1] disabled:opacity-50">
                  {status === 'completed' ? 'Review' : status === 'in_progress' ? 'Continue' : 'View'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pathway.badge_name && (
        <section className={`${glass} rounded-2xl p-5 text-center`}>
          <Award className="mx-auto h-10 w-10 text-amber-400" />
          <h3 className="mt-2 text-sm font-black text-white">Pathway Completion Badge</h3>
          <p className="text-xs text-slate-400">Complete all courses to earn: <span className="font-bold text-amber-400">{pathway.badge_name}</span></p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2">
            <span className="text-2xl">{pathway.badge_icon || '🎓'}</span>
            <span className="text-xs font-bold text-amber-300">{pathway.badge_name}</span>
          </div>
        </section>
      )}
    </div>
  );
}
