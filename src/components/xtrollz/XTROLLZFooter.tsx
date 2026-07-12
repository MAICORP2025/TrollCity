import { Shield, FileText, HelpCircle, Flag, FileCheck, Mail, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function XTROLLZFooter() {
  const navigate = useNavigate()

  const links = [
    { icon: Shield, label: 'Safety Center', to: '/safety' },
    { icon: Flag, label: 'Report Content', to: '/support' },
    { icon: BookOpen, label: 'Community Rules', to: '/xtrollz/rules' },
    { icon: FileText, label: 'Terms', to: '/terms' },
    { icon: FileCheck, label: 'Privacy', to: '/privacy' },
    { icon: FileCheck, label: 'Creator Agreement', to: '/xtrollz/rules' },
    { icon: Mail, label: 'Contact Support', to: '/support' },
    { icon: HelpCircle, label: 'Recordkeeping Information', to: '/legal' },
  ]

  return (
    <footer className="mt-8 border-t border-white/10 bg-black/40">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
          {links.map(({ icon: Icon, label, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-black text-red-400">
            <Shield size={14} />
            18+ ONLY — Verified Adults Only
          </div>
          <p className="text-[10px] text-white/40">
            XTrollz is restricted to verified adults. All streamers and viewers must complete identity verification.
            Content may be monitored by authorized staff.{' '}
            <button onClick={() => navigate('/legal')} className="underline hover:text-white/60">
              Recordkeeping
            </button>
            {' '}applies.
          </p>
          <p className="text-[10px] text-white/30">
            &copy; {new Date().getFullYear()} XTrollz. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
