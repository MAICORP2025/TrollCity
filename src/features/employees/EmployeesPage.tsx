import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import {
  getEmployeeTabs, isAdmin, isEmployeeProfile, type EmployeeTabId, type EmployeeProfileLike,
} from './permissions'
import { OnlineEmployees } from './components/OnlineEmployees'
import { format12hr } from '../../utils/timeFormat'

import HomeTab from './tabs/HomeTab'
import ClockTab from './tabs/ClockTab'
import ScheduleTab from './tabs/ScheduleTab'
import ChatTab from './tabs/ChatTab'
import TasksTab from './tabs/TasksTab'
import ReportsTab from './tabs/ReportsTab'
import AnnouncementsTab from './tabs/AnnouncementsTab'
import ChangeRequestsTab from './tabs/ChangeRequestsTab'
import FrontendStudioTab from './tabs/FrontendStudioTab'
import DepartmentToolsTab from './tabs/DepartmentToolsTab'
import ModerationTab from './tabs/ModerationTab'
import ManagementTab from './tabs/ManagementTab'
import HiringTab from './tabs/HiringTab'
import AttendanceTab from './tabs/AttendanceTab'
import RecordsTab from './tabs/RecordsTab'
import EmploymentVerificationTab from './tabs/EmploymentVerificationTab'

const TAB_COMPONENTS: Record<EmployeeTabId, React.ComponentType<any>> = {
  home: HomeTab,
  clock: ClockTab,
  schedule: ScheduleTab,
  chat: ChatTab,
  tasks: TasksTab,
  reports: ReportsTab,
  announcements: AnnouncementsTab,
  change_requests: ChangeRequestsTab,
  frontend_studio: FrontendStudioTab,
  department_tools: DepartmentToolsTab,
  moderation: ModerationTab,
  management: ManagementTab,
  hiring: HiringTab,
  attendance: AttendanceTab,
  records: RecordsTab,
  employment_verification: EmploymentVerificationTab,
}

function useClockStatus(userId?: string | null) {
  const [active, setActive] = useState<any>(null)
  useEffect(() => {
    if (!userId) return
    let alive = true
    const load = async () => {
      const { data } = await supabase
        .from('officer_work_sessions')
        .select('*')
        .eq('officer_id', userId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (alive) setActive(data || null)
    }
    load()
    const ch = supabase
      .channel(`emp-clock:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'officer_work_sessions', filter: `officer_id=eq.${userId}` }, load)
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [userId])
  return active
}

export default function EmployeesPage() {
  const { user, profile } = useAuthStore()
  const tabs = useMemo(() => getEmployeeTabs(profile as EmployeeProfileLike | null), [profile])
  const [activeTab, setActiveTab] = useState<EmployeeTabId>('home')
  const [previewRole, setPreviewRole] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const active = useClockStatus(user?.id)

  // If the active tab is hidden for this role, fall back to home.
  useEffect(() => {
    if (tabs.length && !tabs.find((t) => t.id === activeTab)) { 
      setActiveTab('home')
    }
  }, [tabs, activeTab])

  if (!isEmployeeProfile(profile as EmployeeProfileLike | null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
          <h1 className="text-2xl font-bold">Employees Office</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your account is not an approved Troll City employee role. Visit the{' '}
            <a className="text-cyan-300 underline" href="/careers">Careers</a> page to apply.
          </p>
        </div>
      </div>
    )
  }

  const previewProfile: EmployeeProfileLike | null = previewRole
    ? { ...(profile as EmployeeProfileLike), role: previewRole }
    : (profile as EmployeeProfileLike | null)

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? HomeTab

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-3 md:flex-row md:p-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-6 space-y-4">
            <EmployeesHeader profile={profile as EmployeeProfileLike} active={active} />
            <nav className="space-y-1 rounded-2xl border border-white/10 bg-black/30 p-2">
              {tabs.map((t) => {
                const Icon = t.icon
                const isActive = t.id === activeTab
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
            <OnlineEmployees currentUserId={user?.id} />
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 space-y-4">
          {/* Mobile top bar */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-3 md:hidden">
            <div>
              <p className="text-sm font-bold">Employees Office</p>
              <p className="text-xs text-slate-400">{profile?.role?.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={() => setMobileNavOpen((v) => !v)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs">
              Menu
            </button>
          </div>

          {mobileNavOpen && (
            <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 md:hidden">
              {tabs.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTab(t.id); setMobileNavOpen(false) }}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${t.id === activeTab ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
          )}

          {isAdmin(profile as EmployeeProfileLike) && (
            <AdminPreviewBar previewRole={previewRole} setPreviewRole={setPreviewRole} />
          )}

          <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-slate-400">Loading…</div>}>
            <ActiveComponent profile={previewProfile} realProfile={profile as EmployeeProfileLike} />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

function EmployeesHeader({ profile, active }: { profile?: EmployeeProfileLike | null; active: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">Troll City Employees</p>
      <h1 className="mt-1 text-xl font-black">{profile?.username ?? 'Employee'}</h1>
      <p className="text-sm capitalize text-cyan-300">{(profile?.role ?? '').replace(/_/g, ' ')}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
          active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'
        }`}>
          <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
          {active ? (active.status === 'break' ? 'On Break' : 'Clocked In') : 'Clocked Out'}
        </span>
        {active && (
          <span className="text-xs text-slate-400">since {format12hr(new Date(active.clock_in))}</span>
        )}
      </div>
    </div>
  )
}

function AdminPreviewBar({ previewRole, setPreviewRole }: { previewRole: string | null; setPreviewRole: (r: string | null) => void }) {
  const roles = ['troll_officer', 'lead_troll_officer', 'secretary', 'ceo_assistant', 'noah_assistant']
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-amber-200">Admin Role Preview (does not change your access)</span>
        {previewRole && <button onClick={() => setPreviewRole(null)} className="text-amber-300 underline">Exit preview</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r}
            onClick={() => setPreviewRole(r)}
            className={`rounded-lg border px-2.5 py-1 capitalize ${previewRole === r ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-white/10 text-slate-300'}`}
          >
            {r.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      {previewRole && <p className="mt-2 text-amber-200/80">Viewing as: {previewRole.replace(/_/g, ' ')}</p>}
    </div>
  )
}
