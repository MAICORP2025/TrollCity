import React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  FileText,
  Gavel,
  Lock,
  MessageSquare,
  Shield,
  Siren,
  Users,
} from 'lucide-react'

export default function Safety() {
  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(239,68,68,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Shield className="h-4 w-4" />
                Troll City Safety Division
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Safety &
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-red-300 bg-clip-text text-transparent">
                  City Policies
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Troll City is built around freedom of speech, human moderation, city rules, courts, reports, and jail-style restrictions instead of chaotic permanent-only bans.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard icon={Users} label="Citizens" value="Protected" />
              <StatCard icon={Gavel} label="Court" value="Appeals" />
              <StatCard icon={Siren} label="Reports" value="Reviewed" danger />
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <PolicyCard icon={Users} title="Community Guidelines">
            <PolicyItem
              title="Respect Other Citizens"
              text="Harassment, targeted bullying, threats, hate speech, intimidation, and discrimination are not allowed."
            />
            <PolicyItem
              title="No Illegal Activity"
              text="Do not use Troll City to promote or coordinate illegal goods, fraud, violence, weapons trafficking, drugs, or other prohibited activity."
            />
            <PolicyItem
              title="No Scams or Fraud"
              text="Do not deceive users, fake payments, misrepresent listings, impersonate others, or manipulate payouts, coins, auctions, gifts, or marketplace transactions."
            />
            <PolicyItem
              title="Adult Platform Rules"
              text="Users must follow Troll City account-age rules and platform restrictions. Content that exploits or endangers minors is strictly prohibited."
            />
          </PolicyCard>

          <PolicyCard icon={AlertTriangle} title="Reporting Violations" accent="yellow">
            <p className="mb-4 text-sm leading-6 text-slate-300">
              If you see a violation, report it through the app so Troll Officers can review the situation.
            </p>

            <StepList
              items={[
                'Use the report button on a profile, stream, post, or message.',
                'Choose the closest violation reason.',
                'Add details, screenshots, or context if available.',
                'A Troll Officer or admin reviews the report and decides the next step.',
              ]}
            />

            <Notice tone="yellow">
              False or abusive reports can lead to restrictions. Only report genuine issues.
            </Notice>
          </PolicyCard>

          <PolicyCard icon={Lock} title="Privacy & Security">
            <PolicyItem
              title="Your Account"
              text="Keep your login secure. Do not share passwords, one-time codes, admin access, officer access, or private account credentials."
            />
            <PolicyItem
              title="Payments & Coins"
              text="Payment and coin activity should only happen through approved Troll City flows. Never send payment information to users through chat."
            />
            <PolicyItem
              title="Blocking & Boundaries"
              text="You can block users and avoid unwanted contact. Staff may also restrict messages, streams, or access when safety requires it."
            />
          </PolicyCard>

          <PolicyCard icon={Ban} title="Moderation Actions" accent="red">
            <PolicyItem
              title="Warning"
              text="Used for lower-level or first-time violations. You may receive a notification explaining the issue."
            />
            <PolicyItem
              title="Stream Restrictions"
              text="Streams may be ended, chat may be disabled, microphones may be muted, or broadcast access may be temporarily restricted."
            />
            <PolicyItem
              title="Jail System"
              text="Instead of only banning users, Troll City may use timed jail restrictions, court summons, bond, and appeal systems depending on the violation."
            />
            <PolicyItem
              title="Account Ban"
              text="Serious violations, repeat abuse, fraud, or dangerous behavior can lead to temporary or permanent bans."
            />
          </PolicyCard>

          <PolicyCard icon={Gavel} title="Appeals & Court">
            <p className="text-sm leading-6 text-slate-300">
              If you believe a moderation action was wrong, you can appeal through support or the court system when available. Being honest about what happened and showing that you understand the issue can help your case.
            </p>

            <Notice tone="cyan">
              Troll City uses human review where possible. Appeals are not guaranteed, but they are part of the city process.
            </Notice>
          </PolicyCard>

          <PolicyCard icon={MessageSquare} title="Need Help?">
            <StepList
              items={[
                'Visit Support from your dashboard.',
                'Contact Troll Officers through the moderation system.',
                'Use court or appeal routes when available.',
                'For urgent payment or account issues, use official support channels only.',
              ]}
            />
          </PolicyCard>
        </section>

        <section className="mt-6 rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-black text-white">Legal Documents</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LegalLink to="/legal/terms" label="Terms of Service" />
            <LegalLink to="/legal/refunds" label="Refund Policy" />
            <LegalLink to="/legal/payouts" label="Payout Policy" />
            <LegalLink to="/legal/safety" label="Safety Guidelines" />
          </div>
        </section>
      </section>
    </main>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: React.ElementType
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        danger
          ? 'border-red-400/20 bg-red-500/5'
          : 'border-cyan-400/20 bg-cyan-500/5'
      }`}
    >
      <Icon className={`mb-3 h-5 w-5 ${danger ? 'text-red-300' : 'text-cyan-300'}`} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function PolicyCard({
  icon: Icon,
  title,
  children,
  accent = 'cyan',
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  accent?: 'cyan' | 'yellow' | 'red'
}) {
  const color =
    accent === 'yellow'
      ? 'border-yellow-400/20 bg-yellow-500/5 text-yellow-300'
      : accent === 'red'
        ? 'border-red-400/20 bg-red-500/5 text-red-300'
        : 'border-cyan-400/20 bg-cyan-500/5 text-cyan-300'

  return (
    <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  )
}

function PolicyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <h3 className="font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  )
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">
            {index + 1}
          </span>
          <span className="text-sm leading-6 text-slate-300">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Notice({
  children,
  tone = 'cyan',
}: {
  children: React.ReactNode
  tone?: 'cyan' | 'yellow'
}) {
  return (
    <div
      className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${
        tone === 'yellow'
          ? 'border-yellow-400/20 bg-yellow-500/10 text-yellow-100'
          : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
      }`}
    >
      {children}
    </div>
  )
}

function LegalLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-cyan-400/15 bg-black/30 px-4 py-3 text-sm font-black text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10 hover:text-white"
    >
      {label}
    </Link>
  )
}