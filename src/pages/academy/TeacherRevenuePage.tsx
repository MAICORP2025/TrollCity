import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getTeacherByUserId, getTeacherPayouts, getTeacherCourses } from '@/services/academyService';
import type { AcademyTeacher, AcademyCourse } from '@/types/academy';
import {
  ChevronLeft, DollarSign, TrendingUp, Users, Award, Clock,
  CheckCircle, Loader2, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function TeacherRevenuePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);

        const [coursesData, payoutsData] = await Promise.all([
          getTeacherCourses(teacherData.id),
          getTeacherPayouts(teacherData.id),
        ]);
        setCourses(coursesData);
        setPayouts(payoutsData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [user?.id]);

  const totalEarnings = teacher?.total_earnings || 0;
  const pendingPayout = teacher?.pending_payout || 0;
  const completedPayouts = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const pendingPayouts = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;
  if (!teacher) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>

      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Revenue Center</h1>
            <p className="text-sm text-slate-400">{teacher.teacher_id} • Earnings & payouts</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <DollarSign className="mx-auto h-5 w-5 text-emerald-400" />
          <p className="mt-1 text-xl font-black text-white">{totalEarnings.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400">Total Earnings</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <Clock className="mx-auto h-5 w-5 text-amber-400" />
          <p className="mt-1 text-xl font-black text-white">{pendingPayout.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400">Pending Payout</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <CheckCircle className="mx-auto h-5 w-5 text-blue-400" />
          <p className="mt-1 text-xl font-black text-white">{completedPayouts.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400">Paid Out</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <Users className="mx-auto h-5 w-5 text-purple-400" />
          <p className="mt-1 text-xl font-black text-white">{teacher.total_students}</p>
          <p className="text-[9px] text-slate-400">Total Students</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Revenue by Course</h2>
          {courses.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">No courses yet.</p>
          ) : (
            <div className="space-y-2">
              {courses.map(course => (
                <div key={course.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                  <div>
                    <p className="text-xs font-bold text-white">{course.name}</p>
                    <p className="text-[9px] text-slate-500">{course.enrolled_count || 0} students • {course.enrollment_fee} coins</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">{((course.enrolled_count || 0) * course.enrollment_fee).toLocaleString()}</p>
                    <p className="text-[9px] text-slate-500">coins earned</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Payout History</h2>
          {payouts.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">No payouts yet.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {payouts.map(payout => (
                <div key={payout.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    {payout.status === 'completed' ? <CheckCircle className="h-4 w-4 text-emerald-400" /> :
                     payout.status === 'pending' ? <Clock className="h-4 w-4 text-amber-400" /> :
                     <ArrowDownRight className="h-4 w-4 text-red-400" />}
                    <div>
                      <p className="text-xs font-bold text-white">{payout.amount.toLocaleString()} coins</p>
                      <p className="text-[9px] text-slate-500">{payout.payout_type} • {new Date(payout.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${payout.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : payout.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                    {payout.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
