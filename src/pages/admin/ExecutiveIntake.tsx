import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  AlertTriangle,
  Users,
  Shield,
  Clock,
  CheckCircle2,
  FileText,
  Building2,
  Briefcase
} from 'lucide-react'

import ExecutiveIntakeList from './components/shared/ExecutiveIntakeList'

const intakeCategories = [
  {
    title: 'Executive Requests',
    description: 'Strategic requests requiring executive review or approval.',
    icon: Briefcase,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    stats: '14 Open'
  },
  {
    title: 'Operations Escalations',
    description: 'Urgent operational incidents and service disruptions.',
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    stats: '3 Critical'
  },
  {
    title: 'Secretary Intake',
    description: 'Scheduling, coordination, approvals, and executive support.',
    icon: ClipboardList,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    stats: '9 Pending'
  },
  {
    title: 'HR & Personnel',
    description: 'Sensitive employee and staffing related requests.',
    icon: Users,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    stats: '5 Active'
  },
  {
    title: 'Compliance & Legal',
    description: 'Legal review, contracts, governance, and compliance.',
    icon: Shield,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    stats: '7 Under Review'
  },
  {
    title: 'Documentation',
    description: 'Policies, reports, records, and executive documentation.',
    icon: FileText,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    stats: '12 Drafts'
  }
]

const quickStats = [
  {
    label: 'Open Cases',
    value: '42',
    icon: Clock,
    color: 'text-orange-400'
  },
  {
    label: 'Resolved Today',
    value: '18',
    icon: CheckCircle2,
    color: 'text-green-400'
  },
  {
    label: 'Departments',
    value: '6',
    icon: Building2,
    color: 'text-blue-400'
  }
]

export default function ExecutiveIntake() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Top Navigation */}
        <nav aria-label="Back navigation">
          <Link
            to="/admin"
            className="
              inline-flex items-center gap-2
              text-slate-400 hover:text-white
              transition-colors
              rounded-md
              focus:outline-none
              focus:ring-2
              focus:ring-slate-500
            "
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
        </nav>

        {/* Hero Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-sm text-slate-300">
              <ClipboardList className="w-4 h-4 text-cyan-400" />
              Executive Operations Center
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                Executive Intake System
              </h1>

              <p className="mt-2 text-slate-400 max-w-3xl">
                Centralized intake management for executive requests,
                escalations, operational coordination, compliance review,
                and secretary workflow management.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            {quickStats.map((stat) => {
              const Icon = stat.icon

              return (
                <div
                  key={stat.label}
                  className="
                    bg-slate-900
                    border border-slate-800
                    rounded-xl
                    p-4
                    min-w-[120px]
                  "
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>

                  <div className="text-2xl font-bold">
                    {stat.value}
                  </div>

                  <div className="text-xs text-slate-400">
                    {stat.label}
                  </div>
                </div>
              )
            })}
          </div>
        </header>

        {/* Intake Categories */}
        <section
          aria-label="Executive intake categories"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {intakeCategories.map((category) => {
            const Icon = category.icon

            return (
              <div
                key={category.title}
                className={`
                  rounded-2xl
                  border
                  p-5
                  transition-all
                  hover:scale-[1.01]
                  hover:border-slate-700
                  ${category.bg}
                `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="
                      w-11 h-11
                      rounded-xl
                      bg-slate-950/60
                      border border-slate-800
                      flex items-center justify-center
                    "
                  >
                    <Icon className={`w-5 h-5 ${category.color}`} />
                  </div>

                  <span
                    className="
                      text-xs
                      px-2 py-1
                      rounded-full
                      bg-slate-950/50
                      border border-slate-800
                      text-slate-300
                    "
                  >
                    {category.stats}
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">
                    {category.title}
                  </h2>

                  <p className="text-sm text-slate-400 leading-relaxed">
                    {category.description}
                  </p>
                </div>
              </div>
            )
          })}
        </section>

        {/* Intake Queue */}
        <section
          aria-label="Executive intake queue"
          className="
            bg-slate-900
            border border-slate-800
            rounded-2xl
            overflow-hidden
          "
        >
          <div
            className="
              flex items-center justify-between
              px-6 py-5
              border-b border-slate-800
            "
          >
            <div>
              <h2 className="text-xl font-semibold">
                Intake Queue
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Active requests, escalations, and executive workflows.
              </p>
            </div>
          </div>

          <div className="p-6">
            <ExecutiveIntakeList viewMode="admin" />
          </div>
        </section>

      </div>
    </main>
  )
}