import React from 'react'
import UserManagementPanel from './components/UserManagementPanel'

export default function RoleManagement() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <UserManagementPanel
          title="Role Management"
          description="Assign roles, adjust levels, and keep authority in sync."
        />
      </div>
    </div>
  )
}
