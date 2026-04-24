import React from 'react'
import UsersPanel from './components/UsersPanel'

export default function BanManagement() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <UsersPanel title="Ban Management" description="View and ban users directly from the dashboard" />
      </div>
    </div>
  )
}
