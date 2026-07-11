import React from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  Lock,
  Users,
  FileText,
  Eye,
  Radio,
  AlertTriangle,
  Ban,
  Settings,
  MessageCircle,
  Activity,
} from 'lucide-react'

const tools = [
  { label: 'Chat Moderation', icon: MessageCircle, to: '/admin/chat-moderation', desc: 'Review and moderate live chat' },
  { label: 'Jail Management', icon: Lock, to: '/admin/jail-management', desc: 'Monitor city inmates' },
  { label: 'Reports Queue', icon: FileText, to: '/admin/reports-queue', desc: 'Review user reports' },
  { label: 'Stream Monitor', icon: Eye, to: '/admin/stream-monitor', desc: 'Watch active broadcasts' },
  { label: 'Night Watch', icon: Radio, to: '/admin/night-watch', desc: 'Patrol and oversight' },
  { label: 'Officer Operations', icon: Shield, to: '/admin/officer-operations', desc: 'Manage officers and shifts' },
  { label: 'User Search', icon: Users, to: '/admin/user-search', desc: 'Find and inspect users' },
  { label: 'Stream Restrictions', icon: Ban, to: '/admin', desc: 'Manage broadcast lockdowns' },
  { label: 'System Config', icon: Settings, to: '/admin/system/config', desc: 'Edit platform settings' },
  { label: 'Activity Log', icon: Activity, to: '/admin/activity', desc: 'Monitor user activity' },
]

export default function SecurityCommandCenter() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%)]" />
      </div>

      <section className="relative z-10 mx-auto max-w-5xl px-4 py-8 md:px-8">
        <header className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white md:text-4xl">Security Command</h1>
              <p className="text-xs text-slate-400">Admin security and moderation hub</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.to}
                to={tool.to}
                className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-black text-white">{tool.label}</span>
                </div>
                <p className="text-[11px] text-slate-400">{tool.desc}</p>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
