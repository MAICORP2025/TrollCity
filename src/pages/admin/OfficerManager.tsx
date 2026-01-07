import React from 'react'
import OfficerManagementTab from './components/OfficerManagementTab'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function OfficerManager() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <h1 className="text-3xl font-bold text-white">Officer Management</h1>
        <p className="text-slate-400">Manage officer roles, statuses, and badges</p>
        
        <OfficerManagementTab />
      </div>
    </div>
  )
}
