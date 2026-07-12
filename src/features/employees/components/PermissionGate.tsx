import React from 'react'
import { canEmployee, type EmployeeAction, type EmployeeProfileLike } from '../permissions'

export function PermissionGate({
  profile,
  action,
  children,
  fallback = null,
}: {
  profile: EmployeeProfileLike | null | undefined
  action: EmployeeAction
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  if (!canEmployee(profile, action)) return <>{fallback}</>
  return <>{children}</>
}
