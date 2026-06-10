import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getApprovedTeachers, suspendTeacher, reactivateTeacher, getTeacherCredentials, verifyCredential } from '@/services/academyService';
import type { AcademyTeacher } from '@/types/academy';
import {
  ChevronLeft, Users, Shield, CheckCircle, XCircle, AlertTriangle,
  Search, FileText, Award, UserX, UserCheck, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function TeacherManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [teachers, setTeachers] = useState<AcademyTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<AcademyTeacher | null>(null);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teachersData = await getApprovedTeachers();
        setTeachers(teachersData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleSuspend = async () => {
    if (!selectedTeacher || !suspensionReason.trim()) { toast.error('Reason required'); return; }
    try {
      await suspendTeacher(selectedTeacher.id, user!.id, suspensionReason);
      toast.success('Teacher suspended');
      setTeachers(prev => prev.map(t => t.id === selectedTeacher.id ? { ...t, is_active: false } : t));
      setShowSuspendConfirm(false);
      setSuspensionReason('');
      setSelectedTeacher(null);
    } catch { toast.error('Failed to suspend'); }
  };

  const handleReactivate = async (teacherId: string) => {
    try {
      await reactivateTeacher(teacherId);
      toast.success('Teacher reactivated');
      setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, is_active: true, suspended_at: null } : t));
    } catch { toast.error('Failed to reactivate'); }
  };

  const handleViewCredentials = async (teacher: AcademyTeacher) => {
    setSelectedTeacher(teacher);
    const creds = await getTeacherCredentials(teacher.id);
    setCredentials(creds);
  };

  const handleVerifyCredential = async (credId: string) => {
    try {
      await verifyCredential(credId, user!.id);
      setCredentials(prev => prev.map(c => c.id === credId ? { ...c, is_verified: true, verified_by: user!.id, verified_at: new Date().toISOString() } : c));
      toast.success('Credential verified');
    } catch { toast.error('Failed to verify'); }
  };

  const filtered = teachers.filter(t => {
    if (filter === 'active' && !t.is_active) return false;
    if (filter === 'suspended' && t.is_active) return false;
    if (filter === 'pending' && t.is_approved) return false;
    if (searchQuery && !t.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !t.teacher_id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <button onClick={() => navigate('/academy/admin')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Admin
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Teacher Management</h1>
            <p className="text-sm text-slate-400">{teachers.length} teachers • Manage credentials, suspension, verification</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {(['all', 'active', 'suspended', 'pending'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold transition ${filter === f ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search teachers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.05] py-1.5 pl-7 pr-3 text-xs text-white outline-none" />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(teacher => (
          <div key={teacher.id} className={`${glass} rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-sm font-black text-purple-300">
                  {(teacher.display_name || teacher.username || 'T')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{teacher.display_name || teacher.username}</p>
                  <p className="text-[9px] text-slate-500">{teacher.teacher_id} • {teacher.total_students} students • Rating: {teacher.average_rating.toFixed(1)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${teacher.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  {teacher.is_active ? 'Active' : 'Suspended'}
                </span>
                {teacher.credentials_verified && <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[8px] font-bold text-blue-300">Verified</span>}
                <button onClick={() => handleViewCredentials(teacher)} className="rounded-lg bg-white/[0.06] p-1.5 text-slate-400 hover:text-white" title="Credentials">
                  <FileText className="h-3.5 w-3.5" />
                </button>
                {teacher.is_active ? (
                  <button onClick={() => { setSelectedTeacher(teacher); setShowSuspendConfirm(true); }}
                    className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20" title="Suspend">
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button onClick={() => handleReactivate(teacher.id)}
                    className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20" title="Reactivate">
                    <UserCheck className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Credential Modal */}
      {selectedTeacher && !showSuspendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setSelectedTeacher(null); setCredentials([]); }}>
          <div className={`${glass} rounded-2xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-white">Credentials — {selectedTeacher.display_name || selectedTeacher.username}</h2>
              <button onClick={() => { setSelectedTeacher(null); setCredentials([]); }} className="text-slate-400 hover:text-white"><XCircle className="h-4 w-4" /></button>
            </div>
            {credentials.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-6">No credentials uploaded.</p>
            ) : (
              <div className="space-y-2">
                {credentials.map(cred => (
                  <div key={cred.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{cred.title}</p>
                        <p className="text-[9px] text-slate-500">{cred.credential_type} • {cred.issuing_organization || 'N/A'}</p>
                        {cred.document_url && <a href={cred.document_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400">View Document →</a>}
                      </div>
                      {cred.is_verified ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[8px] font-bold text-emerald-300">Verified</span>
                      ) : (
                        <button onClick={() => handleVerifyCredential(cred.id)}
                          className="rounded-lg bg-blue-500/20 px-2 py-1 text-[8px] font-bold text-blue-300 hover:bg-blue-500/30">
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {showSuspendConfirm && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSuspendConfirm(false)}>
          <div className={`${glass} rounded-2xl p-5 max-w-md w-full`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h2 className="text-sm font-black text-white">Suspend Teacher</h2>
            </div>
            <p className="text-xs text-slate-400 mb-3">Are you sure you want to suspend <span className="font-bold text-white">{selectedTeacher.display_name || selectedTeacher.username}</span>?</p>
            <textarea rows={3} value={suspensionReason} onChange={e => setSuspensionReason(e.target.value)}
              placeholder="Reason for suspension..."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSuspendConfirm(false)} className="rounded-lg bg-white/[0.06] px-4 py-2 text-xs font-bold text-slate-400">Cancel</button>
              <button onClick={handleSuspend} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white">Suspend</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
