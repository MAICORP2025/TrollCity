import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#09050f] text-white">
                <div className="glass-card rounded-3xl p-8 text-center">Loading admin access...</div>
            </div>
        )
    }

    if (!user || user.role !== 'admin') {
        return <Navigate to="/login" replace />
    }

    return children
}
