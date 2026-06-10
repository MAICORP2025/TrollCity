import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface Metrics {
    total_tips_purchased: number
    total_tips_sent: number
    platform_revenue_cents: number
    creator_revenue_cents: number
    pending_cashouts: number
    approved_cashouts: number
    rejected_cashouts: number
}

interface LiveStreamMonitorRow {
    stream_id: string
    title: string
    category: string
    status: string
    viewer_count: number
    livekit_room_id: string
    active: boolean
    participant_count: number
    max_participants: number
    last_seen_at: string
    broadcaster_username: string
    broadcaster_email: string
}

export default function AdminPage() {
    const { user, signOut } = useAuth()
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [liveStreams, setLiveStreams] = useState<LiveStreamMonitorRow[]>([])
    const [moderatorEmail, setModeratorEmail] = useState('')
    const [adminMessage, setAdminMessage] = useState('')
    const [creatingModerator, setCreatingModerator] = useState(false)

    useEffect(() => {
        fetchAdminData()
    }, [])

    const fetchAdminData = async () => {
        const [{ data: analytics }, { data: monitorData }] = await Promise.all([
            supabase.from('admin_tip_analytics').select('*').single(),
            supabase.from('live_stream_monitor').select('*')
        ])

        setMetrics(analytics)
        setLiveStreams(monitorData || [])
    }

    const promoteModerator = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!moderatorEmail) return
        setCreatingModerator(true)
        setAdminMessage('')

        const { data: userProfile, error: lookupError } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('email', moderatorEmail)
            .single()

        if (lookupError || !userProfile) {
            setAdminMessage('No existing user found for that email. Moderators must sign up first.')
            setCreatingModerator(false)
            return
        }

        if (userProfile.role === 'moderator') {
            setAdminMessage('This user is already a moderator.')
            setCreatingModerator(false)
            return
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'moderator', updated_at: new Date().toISOString() })
            .eq('id', userProfile.id)

        if (updateError) {
            setAdminMessage(updateError.message)
        } else {
            setAdminMessage('Moderator role assigned successfully.')
            setModeratorEmail('')
        }

        setCreatingModerator(false)
    }

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#09050f] text-white">
                <div className="glass-card rounded-3xl p-8 text-center">Loading admin page...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#09050f] text-white">
            <div className="mx-auto max-w-screen-2xl px-4 py-8">
                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-4xl font-semibold">Admin Dashboard</h1>
                        <p className="mt-2 text-slate-400">Professional moderation tools, real-time monitoring, and platform controls.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={signOut} className="glow-button">Sign out</button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3 mb-8">
                    <div className="glass-card rounded-3xl p-6">
                        <h2 className="text-lg font-semibold text-slate-200">Total Tips Purchased</h2>
                        <p className="mt-4 text-3xl font-bold text-blue-300">{metrics ? metrics.total_tips_purchased : '—'}</p>
                    </div>
                    <div className="glass-card rounded-3xl p-6">
                        <h2 className="text-lg font-semibold text-slate-200">Platform Revenue</h2>
                        <p className="mt-4 text-3xl font-bold text-blue-300">${metrics ? (metrics.platform_revenue_cents / 100).toFixed(2) : '—'}</p>
                    </div>
                    <div className="glass-card rounded-3xl p-6">
                        <h2 className="text-lg font-semibold text-slate-200">Creator Revenue</h2>
                        <p className="mt-4 text-3xl font-bold text-blue-300">${metrics ? (metrics.creator_revenue_cents / 100).toFixed(2) : '—'}</p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[2fr_1fr] mb-8">
                    <div className="glass-card rounded-3xl p-6">
                        <h2 className="text-2xl font-semibold mb-4">Real-Time Stream Monitor</h2>
                        <div className="space-y-4">
                            {liveStreams.length === 0 ? (
                                <p className="text-slate-400">No active live streams currently detected.</p>
                            ) : (
                                liveStreams.map((stream) => (
                                    <div key={stream.stream_id} className="rounded-3xl border border-blue-500/10 bg-slate-950/80 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">{stream.title}</h3>
                                                <p className="text-slate-400 text-sm">{stream.broadcaster_username} · {stream.category}</p>
                                            </div>
                                            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs uppercase tracking-[0.18em] text-blue-200">{stream.status}</span>
                                        </div>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl bg-white/5 p-3 text-sm text-slate-300">
                                                <p className="font-semibold">Viewers</p>
                                                <p>{stream.viewer_count}</p>
                                            </div>
                                            <div className="rounded-2xl bg-white/5 p-3 text-sm text-slate-300">
                                                <p className="font-semibold">Participants</p>
                                                <p>{stream.participant_count}/{stream.max_participants}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="glass-card rounded-3xl p-6">
                        <h2 className="text-2xl font-semibold mb-4">Moderator Controls</h2>
                        <p className="text-slate-400 mb-4">Assign moderator privileges to an existing signed-up user.</p>
                        <form onSubmit={promoteModerator} className="space-y-4">
                            <label className="block">
                                <span className="text-sm text-slate-300">Moderator email</span>
                                <input
                                    type="email"
                                    value={moderatorEmail}
                                    onChange={(e) => setModeratorEmail(e.target.value)}
                                    placeholder="moderator@example.com"
                                    className="mt-2 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                                    required
                                />
                            </label>
                            <button type="submit" disabled={creatingModerator} className="glow-button w-full justify-center disabled:opacity-70">
                                {creatingModerator ? 'Updating...' : 'Assign Moderator'}
                            </button>
                        </form>
                        {adminMessage && <p className="mt-4 text-sm text-blue-200">{adminMessage}</p>}
                    </div>
                </div>

                <div className="glass-card rounded-3xl p-6">
                    <h2 className="text-2xl font-semibold mb-4">Live stream and moderation audit</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-3xl border border-blue-500/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                            <p className="font-semibold">Pending cashouts</p>
                            <p className="mt-2 text-3xl text-blue-200">{metrics?.pending_cashouts ?? '—'}</p>
                        </div>
                        <div className="rounded-3xl border border-blue-500/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                            <p className="font-semibold">Approved cashouts</p>
                            <p className="mt-2 text-3xl text-blue-200">{metrics?.approved_cashouts ?? '—'}</p>
                        </div>
                        <div className="rounded-3xl border border-blue-500/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                            <p className="font-semibold">Rejected cashouts</p>
                            <p className="mt-2 text-3xl text-blue-200">{metrics?.rejected_cashouts ?? '—'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
