import React from 'react'
import CriticalAlertsList from './components/shared/CriticalAlertsList'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function CriticalAlertsManager() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <h1 className="text-3xl font-bold text-white">Critical Alerts</h1>
        <p className="text-slate-400">Monitor and resolve system alerts</p>
        
        <CriticalAlertsList viewMode="admin" />
      </div>
    </div>
  )
}
