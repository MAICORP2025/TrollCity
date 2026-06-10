import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getStudentEnrollments, getLoanPayments, makeLoanPayment } from '@/services/academyService';
import type { AcademyEnrollment } from '@/types/academy';
import {
  ChevronLeft, Wallet, CreditCard, Clock, AlertTriangle, CheckCircle,
  TrendingUp, DollarSign, Loader2, Coins,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function LoanServicingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        const enrollmentsData = await getStudentEnrollments(user.id);
        const loanEnrollments = enrollmentsData.filter(e => (e.loan_balance || 0) > 0);
        setEnrollments(loanEnrollments);

        const paymentsData = await getLoanPayments(user.id);
        setPayments(paymentsData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user?.id]);

  const handlePayment = async (enrollmentId: string, amount: number) => {
    setPaying(enrollmentId);
    try {
      await makeLoanPayment(user!.id, enrollmentId, amount);
      toast.success(`Payment of ${amount.toLocaleString()} coins processed!`);
      const paymentsData = await getLoanPayments(user!.id);
      setPayments(paymentsData);
      const enrollmentsData = await getStudentEnrollments(user!.id);
      setEnrollments(enrollmentsData.filter(e => (e.loan_balance || 0) > 0));
    } catch (err: any) { toast.error(err.message || 'Payment failed'); }
    finally { setPaying(null); }
  };

  const totalOwed = enrollments.reduce((sum, e) => sum + (e.loan_balance || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const coinBalance = (profile as any)?.troll_coins || 0;

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <button onClick={() => navigate('/academy')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Academy
      </button>

      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Academy Finance Center</h1>
            <p className="text-sm text-slate-400">Manage your Academy loans and payments</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <Coins className="mx-auto h-5 w-5 text-amber-400" />
          <p className="mt-1 text-xl font-black text-white">{coinBalance.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400">Coin Balance</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <AlertTriangle className="mx-auto h-5 w-5 text-red-400" />
          <p className="mt-1 text-xl font-black text-white">{totalOwed.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400">Total Owed</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <CheckCircle className="mx-auto h-5 w-5 text-emerald-400" />
          <p className="mt-1 text-xl font-black text-white">{totalPaid.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400">Total Paid</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <TrendingUp className="mx-auto h-5 w-5 text-cyan-400" />
          <p className="mt-1 text-xl font-black text-white">{payments.length}</p>
          <p className="text-[9px] text-slate-400">Payments Made</p>
        </div>
      </div>

      {enrollments.length > 0 && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Active Loans</h2>
          <div className="space-y-3">
            {enrollments.map(enrollment => (
              <div key={enrollment.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{enrollment.course_name}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Balance: <span className="font-bold text-red-400">{(enrollment.loan_balance || 0).toLocaleString()}</span></span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Weekly: <span className="font-bold text-amber-400">{(enrollment.weekly_due || 0).toLocaleString()}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {enrollment.weekly_due && enrollment.weekly_due > 0 && (
                      <button onClick={() => handlePayment(enrollment.id, enrollment.weekly_due)}
                        disabled={paying === enrollment.id || coinBalance < enrollment.weekly_due}
                        className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-50">
                        {paying === enrollment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />} Pay Weekly
                      </button>
                    )}
                    <button onClick={() => handlePayment(enrollment.id, enrollment.loan_balance || 0)}
                      disabled={paying === enrollment.id || coinBalance < (enrollment.loan_balance || 0)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50">
                      {paying === enrollment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Pay in Full
                    </button>
                  </div>
                </div>
                {enrollment.access_paused && (
                  <div className="mt-2 rounded-lg bg-red-500/10 p-2 text-[10px] font-bold text-red-300">
                    ⚠️ Access paused due to overdue payments. Make a payment to restore access.
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`${glass} rounded-2xl p-5`}>
        <h2 className="mb-4 text-sm font-black text-white">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{payment.amount.toLocaleString()} coins</p>
                    <p className="text-[9px] text-slate-500">{new Date(payment.created_at).toLocaleDateString()} • {payment.payment_type}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[8px] font-bold text-emerald-300">{payment.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
