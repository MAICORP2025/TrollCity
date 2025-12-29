import React from 'react'
import OfficerShiftsPanel from './components/OfficerShiftsPanel'

export default function OfficerShifts() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <OfficerShiftsPanel />
      </div>
    </div>
  )
}
