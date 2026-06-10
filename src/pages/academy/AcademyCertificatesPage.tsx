import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { getStudentCertificates } from '@/services/academyService';
import type { AcademyCertificate } from '@/types/academy';
import { Award, ChevronRight } from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyCertificatesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [certificates, setCertificates] = useState<AcademyCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const items = await getStudentCertificates(user.id);
        setCertificates(items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  if (!user) {
    return <div className="mx-auto max-w-3xl p-4 text-center text-slate-300">Please sign in to view certificates.</div>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <section className={`${glass} rounded-3xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-yellow-400" />
              <div>
                <h1 className="text-2xl font-black text-white">My Academy Certificates</h1>
                <p className="text-sm text-slate-400">View your earned credentials and course achievements.</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/academy/courses')} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]">
            Browse Courses
          </button>
        </div>
      </section>

      {certificates.length === 0 ? (
        <div className={`${glass} rounded-3xl p-8 text-center text-slate-400`}>
          <p className="text-sm">No certificates earned yet. Complete a course to unlock your first credential.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div key={cert.id} className={`${glass} rounded-3xl p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{cert.course_name || 'Academy Certificate'}</p>
                  <p className="mt-2 text-sm font-black text-white">{cert.certificate_number || 'Certificate #' + cert.id.slice(0, 6)}</p>
                </div>
                <Award className="h-7 w-7 text-yellow-400" />
              </div>
              <div className="mt-4 text-xs text-slate-400">
                <p>Teacher: {cert.teacher_name || 'TBA'}</p>
                <p>Issued: {new Date(cert.issued_at).toLocaleDateString()}</p>
                <p>Status: {cert.status}</p>
              </div>
              <button onClick={() => navigate('/academy/verify')} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10">
                <ChevronRight className="h-3.5 w-3.5" /> Verify Certificate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
