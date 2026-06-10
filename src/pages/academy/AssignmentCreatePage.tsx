import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getTeacherByUserId, getTeacherCourses, createAssignment, updateCourse } from '@/services/academyService';
import type { AcademyTeacher, AcademyCourse, AcademyAssignment, AssignmentType } from '@/types/academy';
import {
  Plus, Save, Loader2, BookOpen, Calendar, Clock, ChevronLeft, Edit3, Trash2,
  Eye, EyeOff, FileText, AlertCircle, CheckCircle, X, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string; icon: string }[] = [
  { value: 'homework', label: 'Homework', icon: '📝' },
  { value: 'project', label: 'Project', icon: '🔬' },
  { value: 'essay', label: 'Essay', icon: '✍️' },
  { value: 'practical', label: 'Practical', icon: '🔧' },
  { value: 'presentation', label: 'Presentation', icon: '📊' },
];

const SUBMISSION_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'link', label: 'Link' },
];

export default function AssignmentCreatePage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    course_id: courseId || '',
    title: '',
    description: '',
    assignment_type: 'homework' as AssignmentType,
    max_points: 100,
    due_date: '',
    due_time: '23:59',
    allowed_submissions: ['text', 'pdf'] as string[],
    is_published: false,
  });

  useEffect(() => {
    const init = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);
        const coursesData = await getTeacherCourses(teacherData.id);
        setCourses(coursesData);
        if (courseId) setForm(f => ({ ...f, course_id: courseId }));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [user?.id]);

  const toggleSubmissionType = (type: string) => {
    setForm(f => ({
      ...f,
      allowed_submissions: f.allowed_submissions.includes(type)
        ? f.allowed_submissions.filter(t => t !== type)
        : [...f.allowed_submissions, type],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.course_id) { toast.error('Please select a course'); return; }
    setSaving(true);
    try {
      const dueDate = form.due_date ? new Date(`${form.due_date}T${form.due_time}`).toISOString() : null;
      if (editId) {
        await supabase.from('academy_assignments').update({
          ...form,
          due_date: dueDate,
        }).eq('id', editId);
        toast.success('Assignment updated!');
      } else {
        await createAssignment({
          ...form,
          due_date: dueDate,
        });
        toast.success('Assignment created!');
      }
      navigate('/academy/teacher/dashboard');
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;
  if (!teacher) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{editId ? 'Edit Assignment' : 'Create Assignment'}</h1>
            <p className="text-xs text-slate-400">{teacher.teacher_id}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className={`${glass} rounded-2xl p-5 space-y-4`}>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Course *</label>
              <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-purple-400/50">
                <option value="">Select course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Chapter 5 Problem Set"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Description / Instructions</label>
              <textarea rows={6} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detailed instructions for students..."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-slate-300">Assignment Type</label>
              <div className="flex flex-wrap gap-2">
                {ASSIGNMENT_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, assignment_type: t.value }))}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${form.assignment_type === t.value ? 'bg-purple-500 text-white' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Max Points</label>
                <input type="number" min={1} value={form.max_points} onChange={e => setForm(f => ({ ...f, max_points: parseInt(e.target.value) || 100 }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Sort Order</label>
                <input type="number" min={0} defaultValue={0}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Due Time</label>
                <input type="time" value={form.due_time} onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-slate-300">Allowed Submission Types</label>
              <div className="flex flex-wrap gap-2">
                {SUBMISSION_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => toggleSubmissionType(t.value)}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${form.allowed_submissions.includes(t.value) ? 'bg-emerald-500 text-white' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => navigate('/academy/teacher/dashboard')} className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-white">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-2.5 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editId ? 'Update' : 'Create'} Assignment
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${glass} rounded-2xl p-4`}>
            <h3 className="text-xs font-black text-white mb-3">Visibility</h3>
            <button onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
              className={`flex w-full items-center justify-between rounded-xl p-3 transition ${form.is_published ? 'bg-emerald-500/10 border border-emerald-400/30' : 'bg-white/[0.04] border border-white/10'}`}>
              <div className="flex items-center gap-2">
                {form.is_published ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
                <span className="text-xs font-bold text-white">{form.is_published ? 'Published' : 'Draft'}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${form.is_published ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                {form.is_published ? 'Visible to students' : 'Hidden'}
              </span>
            </button>
          </div>

          <div className={`${glass} rounded-2xl p-4`}>
            <h3 className="text-xs font-black text-white mb-2">💡 Tips</h3>
            <ul className="space-y-1 text-[10px] text-slate-400">
              <li>• Set clear due dates and times</li>
              <li>• Use detailed instructions</li>
              <li>• Choose appropriate submission types</li>
              <li>• Save as draft before publishing</li>
              <li>• Students get notified on publish</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
