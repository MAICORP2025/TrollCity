import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApprovedTeachers, getTeacherRatings } from '@/services/academyService';
import type { AcademyTeacher, AcademyTeacherRating } from '@/types/academy';
import {
  Search, Star, Users, Award, BookOpen, ChevronLeft, GraduationCap,
} from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function TeacherDirectoryPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<AcademyTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<AcademyTeacher | null>(null);
  const [ratings, setRatings] = useState<AcademyTeacherRating[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getApprovedTeachers();
        setTeachers(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleSelectTeacher = async (teacher: AcademyTeacher) => {
    setSelectedTeacher(teacher);
    const ratingsData = await getTeacherRatings(teacher.id);
    setRatings(ratingsData);
  };

  const filtered = teachers.filter(t =>
    !searchQuery ||
    t.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.teacher_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.specialties?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate('/academy')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Academy
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Teacher Directory</h1>
            <p className="text-sm text-slate-400">{teachers.length} approved instructors</p>
          </div>
        </div>
      </section>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search teachers by name, ID, or specialty..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-amber-400/50" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {filtered.map(teacher => (
            <button key={teacher.id} onClick={() => handleSelectTeacher(teacher)}
              className={`w-full rounded-xl border p-4 text-left transition ${selectedTeacher?.id === teacher.id ? 'border-amber-400/30 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-sm font-black text-amber-300">
                  {(teacher.display_name || teacher.username || 'T')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">{teacher.display_name || teacher.username}</p>
                  <p className="text-[9px] text-slate-500">{teacher.teacher_id} • {teacher.total_students} students</p>
                  <div className="mt-1 flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-400" />
                    <span className="text-[10px] font-bold text-yellow-400">{teacher.average_rating.toFixed(1)}</span>
                    <span className="text-[9px] text-slate-500">({teacher.total_ratings})</span>
                  </div>
                </div>
              </div>
              {teacher.specialties && teacher.specialties.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {teacher.specialties.slice(0, 4).map(s => (
                    <span key={s} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[8px] font-bold text-slate-400">{s}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-xs text-slate-500 py-8">No teachers found.</p>}
        </div>

        <div>
          {selectedTeacher ? (
            <div className={`${glass} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-lg font-black text-amber-300">
                  {(selectedTeacher.display_name || selectedTeacher.username || 'T')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">{selectedTeacher.display_name || selectedTeacher.username}</h2>
                  <p className="text-xs text-slate-400">{selectedTeacher.teacher_id}</p>
                </div>
              </div>

              {selectedTeacher.bio && <p className="text-xs text-slate-300">{selectedTeacher.bio}</p>}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.04] p-2 text-center"><Users className="mx-auto h-4 w-4 text-blue-400" /><p className="mt-1 text-sm font-bold text-white">{selectedTeacher.total_students}</p><p className="text-[8px] text-slate-400">Students</p></div>
                <div className="rounded-lg bg-white/[0.04] p-2 text-center"><Award className="mx-auto h-4 w-4 text-purple-400" /><p className="mt-1 text-sm font-bold text-white">{selectedTeacher.total_certificates_issued}</p><p className="text-[8px] text-slate-400">Certificates</p></div>
                <div className="rounded-lg bg-white/[0.04] p-2 text-center"><Star className="mx-auto h-4 w-4 text-yellow-400" /><p className="mt-1 text-sm font-bold text-white">{selectedTeacher.average_rating.toFixed(1)}</p><p className="text-[8px] text-slate-400">Rating</p></div>
              </div>

              {selectedTeacher.specialties && selectedTeacher.specialties.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 mb-1">Specialties</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTeacher.specialties.map(s => (
                      <span key={s} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {ratings.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 mb-2">Recent Reviews</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {ratings.slice(0, 5).map(r => (
                      <div key={r.id} className="rounded-lg bg-white/[0.03] p-2">
                        <div className="flex items-center gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-2.5 w-2.5 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} />
                          ))}
                          <span className="text-[9px] text-slate-500 ml-1">{r.student_name || 'Student'}</span>
                        </div>
                        {r.review && <p className="text-[10px] text-slate-400">{r.review}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`${glass} rounded-2xl p-8 text-center`}>
              <GraduationCap className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">Select a teacher to view their profile</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
