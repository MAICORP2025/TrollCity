import { lazy } from 'react'
import type { LazyExoticComponent, ReactNode } from 'react'
import { Database, Shield, RefreshCw, Settings } from 'lucide-react'
import { UserRole } from '../../lib/supabase'

export interface AdminRoute {
  id: string
  title: string
  path: string
  component: LazyExoticComponent<any>
  roles?: UserRole[]
  apiEndpoint?: string
  category?: string
  description?: string
  icon?: ReactNode
  tileColor?: string
  tileBgColor?: string
  tileBorderColor?: string
}

export const systemManagementRoutes: AdminRoute[] = [
  {
    id: 'database-backup',
    title: 'Database Backup',
    path: '/admin/system/backup',
    component: lazy(() => import('./DatabaseBackup')),
    roles: [UserRole.ADMIN],
    description: 'Create a fresh database backup',
    icon: <Database className="w-5 h-5 text-cyan-200" />,
    tileColor: 'text-cyan-200',
    tileBgColor: 'bg-cyan-500/10',
    tileBorderColor: 'border-cyan-500/30',
    category: 'system'
  },
  {
    id: 'system-health',
    title: 'System Health',
    path: '/admin/system/health',
    component: lazy(() => import('./CityControlCenter')),
    roles: [UserRole.ADMIN],
    description: 'Check core service statuses',
    icon: <Shield className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'system'
  },
  {
    id: 'cache-clear',
    title: 'Cache Clear',
    path: '/admin/system/cache',
    component: lazy(() => import('./CacheClear')),
    roles: [UserRole.ADMIN],
    description: 'Flush caches and temporary storage',
    icon: <RefreshCw className="w-5 h-5 text-amber-200" />,
    tileColor: 'text-amber-200',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'system'
  },
  {
    id: 'system-config',
    title: 'System Config',
    path: '/admin/system/config',
    component: lazy(() => import('./SystemConfig')),
    roles: [UserRole.ADMIN],
    description: 'Edit global platform settings',
    icon: <Settings className="w-5 h-5 text-purple-200" />,
    tileColor: 'text-purple-200',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'system'
  },
]
