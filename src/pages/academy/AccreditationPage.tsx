import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getAccreditationOrgs, getAccreditationRequests, submitAccreditationRequest, getTeacherByUserId, getTeacherCourses } from '@/services/academyService';
import type { AcademyTeacher, AcademyCourse } from '@/types/academy';
import {
  ChevronLeft, Award, Building2, CheckCircle, Clock, XCircle, Send,
  Loader2, Shield, FileText, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AccreditationPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ course_id: '', org_id: '', request_notes: '' });

  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);
        const coursesData = await getTeacherCourses(teacherData.id);
        setCourses(coursesData);
        const orgsData = await getAccreditationOrgs();
        setOrgs(orgsData);
        const requestsData = await getAccreditationRequests();
        setRequests(requestsData.filter((r: any) => r.teacher_id === teacherData.id));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [user?.id]);

  const handleSubmit = async () => {
    if (!form.course_id) { toast.error('Select a course'); return; }
    setSubmitting(true);
    try {
      await submitAccreditationRequest({
        course_id: form.course_id,
        teacher_id: teacher!.id,
        org_id: form.org_id || undefined,
        request_notes: form.request_notes,
      });
      toast.success('Accreditation request submitted!');
      setShowForm(false);
      setForm({ course_id: '', org_id: '', request_notes: '' });
      const requestsData = await getAccreditationRequests();
      setRequests(requestsData.filter((r: any) => r.teacher_id === teacher!.id));
    } catch (err: any) { toast.error(err.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;
  if (!teacher) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>

      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Accreditation</h1>
              <p className="text-sm text-slate-400">Get your courses accredited by recognized organizations</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-xl bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30">
            <Plus className="h-3.5 w-3.5" /> New Request
          </button>
        </div>
      </section>

      {showForm && (
        <section className={`${glass} rounded-2xl p-5 space-y-4`}>
          <h2 className="text-sm font-black text-white">New Accreditation Request</h2>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">Course *</label>
            <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none">
              <option value="">Select course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">Accrediting Organization</label>
            <select value={form.org_id} onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none">
              <option value="">Select organization...</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">Notes</label>
            <textarea rows={3} value={form.request_notes} onChange={e => setForm(f => ({ ...f, request_notes: e.target.value }))}
              placeholder="Why should this course be accredited?"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Request
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-slate-400">Cancel</button>
          </div>
        </section>
      )}

      <section className={`${glass} rounded-2xl p-5`}>
        <h2 className="mb-4 text-sm font-black text-white">Accrediting Organizations</h2>
        {orgs.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6">No accrediting organizations configured yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map(org => (
              <div key={org.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-amber-400" />
                  <p className="text-xs font-bold text-white">{org.name}</p>
                </div>
                {org.description && <p className="text-[10px] text-slate-400">{org.description}</p>}
                {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 block">Visit Website →</a>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`${glass} rounded-2xl p-5`}>
        <h2 className="mb-4 text-sm font-black text-white">Your Requests</h2>
        {requests.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6">No accreditation requests yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="text-xs font-bold text-white">{req.course?.name || 'Course'}</p>
                  <p className="text-[9px] text-slate-500">{req.org?.name || 'Organization'} • {new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : req.status === 'denied' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
