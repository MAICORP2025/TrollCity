import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Stream, CreatorProfile } from '../types/database'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [application, setApplication] = useState<any>(null)
  const [requestedDisplayName, setRequestedDisplayName] = useState('')
  const [requestedCategory, setRequestedCategory] = useState('Entertainment')
  const [applicationBio, setApplicationBio] = useState('')
  const [applicationLoading, setApplicationLoading] = useState(false)
  const [applicationMessage, setApplicationMessage] = useState('')

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: profileData }, { data: streamData }, { data: applicationData }] = await Promise.all([
      supabase
        .from('creator_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle(),
      supabase
        .from('streams')
        .select('*')
        .eq('creator_id', user?.id),
      supabase
        .from('streamer_applications')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle()
    ])

    setProfile(profileData)
    setStreams(streamData || [])
    setApplication(applicationData)
    setLoading(false)
  }

  const createStream = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    const { data } = await supabase
      .from('streams')
      .insert({
        creator_id: profile.id,
        title,
        description,
        category: 'Gaming',
        status: 'pending'
      })
      .select()
      .single()

    if (data) {
      setStreams([...streams, data])
      setTitle('')
      setDescription('')
      setShowCreateForm(false)
    }
  }

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setApplicationLoading(true)
    setApplicationMessage('')

    const { error } = await supabase.from('streamer_applications').insert({
      user_id: user.id,
      requested_display_name: requestedDisplayName || user.username,
      requested_category: requestedCategory,
      application_status: 'submitted',
      review_notes: null,
      id_front_path: user.verification_front_path,
      id_back_path: user.verification_back_path,
      selfie_path: user.verification_selfie_path,
      bio: applicationBio,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (error) {
      setApplicationMessage(error.message)
    } else {
      setApplicationMessage('Streamer application submitted. Admin review is pending.')
      fetchData()
    }

    setApplicationLoading(false)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#09050f] text-white">
        <div className="glass-card rounded-3xl p-8 text-center">
          <p>Please log in to access your dashboard.</p>
          <Link to="/login" className="mt-4 inline-flex glow-button">Go to login</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09050f] text-white">
        <div className="glass-card rounded-3xl p-8 text-center">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09050f] text-white">
      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold">Your Dashboard</h1>
            <p className="mt-2 text-slate-400">Manage streams, monitor applications, and track creator status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={signOut} className="glow-button">Sign out</button>
            <Link to="/" className="glow-button bg-slate-700/90">Back to home</Link>
          </div>
        </div>

        {!profile ? (
          <div className="glass-card rounded-3xl p-6">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
              <div>
                <h2 className="text-2xl font-semibold">Apply to become a streamer</h2>
                <p className="mt-2 text-slate-400">Submit your streamer application and wait for admin approval before broadcasting live.</p>
              </div>
            </div>

            {application ? (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Application status</h3>
                    <p className="text-slate-300">{application.application_status}</p>
                  </div>
                  <span className="rounded-full bg-blue-600/20 px-3 py-1 text-sm text-blue-100">{application.application_status}</span>
                </div>
                <p className="text-slate-400">Review notes: {application.review_notes ?? 'Awaiting review from admin'}</p>
              </div>
            ) : (
              <form onSubmit={submitApplication} className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-slate-300">Streamer display name</span>
                    <input
                      type="text"
                      value={requestedDisplayName}
                      onChange={(e) => setRequestedDisplayName(e.target.value)}
                      placeholder="Your channel name"
                      className="mt-2 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-slate-300">Primary category</span>
                    <select
                      value={requestedCategory}
                      onChange={(e) => setRequestedCategory(e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    >
                      <option>Entertainment</option>
                      <option>Music</option>
                      <option>Gaming</option>
                      <option>ASMR</option>
                      <option>Talk Shows</option>
                      <option>VIP</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm text-slate-300">Why you should be approved</span>
                  <textarea
                    value={applicationBio}
                    onChange={(e) => setApplicationBio(e.target.value)}
                    rows={5}
                    placeholder="Tell us about your content, experience, and why you want to stream on Velvet Grid."
                    className="mt-2 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    required
                  />
                </label>

                {applicationMessage && <p className="text-sm text-red-300">{applicationMessage}</p>}

                <button type="submit" disabled={applicationLoading} className="glow-button w-full justify-center disabled:opacity-70">
                  {applicationLoading ? 'Submitting...' : 'Submit streamer application'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] mb-8">
              <div className="glass-card rounded-3xl p-6">
                <h2 className="text-2xl font-semibold">Creator panel</h2>
                <p className="mt-3 text-slate-400">Manage live streams, control guest boxes, and monitor your channel.</p>
              </div>
              <div className="glass-card rounded-3xl p-6">
                <h3 className="text-lg font-semibold">Creator status</h3>
                <div className="mt-4 space-y-3">
                  <p className="text-slate-300"><span className="font-semibold">Category:</span> {profile.category || 'Unassigned'}</p>
                  <p className="text-slate-300"><span className="font-semibold">Live status:</span> {profile.is_live ? 'Live' : 'Offline'}</p>
                  <p className="text-slate-300"><span className="font-semibold">Guest boxes:</span> {profile.guest_boxes_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Your Streams</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="glow-button"
              >
                Create Stream
              </button>
            </div>

            {showCreateForm && (
              <div className="glass-card rounded-3xl p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">New Stream</h3>
                <form onSubmit={createStream} className="space-y-4">
                  <div>
                    <label className="block mb-2 text-slate-300">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-slate-300">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" className="glow-button">Create</button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-3xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {streams.map((stream) => (
                <div key={stream.id} className="glass-card rounded-3xl overflow-hidden border border-blue-500/10 bg-slate-950/80 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                  <div className="aspect-video bg-gradient-to-br from-sky-600/20 to-blue-700/10 p-4">
                    <div className="flex h-full items-end justify-between">
                      <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-blue-100">{stream.status}</span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{stream.viewer_count} viewers</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-white">{stream.title}</h3>
                    <p className="mt-2 text-slate-400 line-clamp-2">{stream.description || 'No description added yet.'}</p>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                      <span>{stream.category}</span>
                      <div className="flex gap-2">
                        <button className="rounded-full border border-blue-500/40 px-3 py-1 text-blue-200">Edit</button>
                        <button className="rounded-full border border-red-500/40 px-3 py-1 text-red-300">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
