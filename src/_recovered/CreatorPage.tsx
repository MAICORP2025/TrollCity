import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { CreatorProfile, Stream } from '../types/database'
import { supabase } from '../lib/supabase'

export default function CreatorPage() {
  const { creatorId } = useParams()
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCreatorData()
  }, [creatorId])

  const fetchCreatorData = async () => {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('creator_profiles')
      .select('*')
      .eq('id', creatorId)
      .single()
    
    if (profileData) {
      setProfile(profileData)
      const { data: streamData } = await supabase
        .from('streams')
        .select('*')
        .eq('creator_id', profileData.id)
        .eq('status', 'live')
      setStreams(streamData || [])
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!profile) {
    return <div className="flex items-center justify-center min-h-screen">Creator not found</div>
  }

  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <div className="flex items-start space-x-6">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full"></div>
            <div>
              <h1 className="text-3xl font-bold mb-2">{profile.category || 'Creator'}</h1>
              <p className="text-gray-400 mb-4">{profile.bio || 'No bio available'}</p>
              <div className="flex items-center space-x-4">
                <span className="bg-gray-800 px-3 py-1 rounded-full text-sm">
                  {profile.is_live ? 'Live' : 'Offline'}
                </span>
                <button className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg transition">
                  Follow
                </button>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">Live Streams</h2>
        {streams.length === 0 ? (
          <p className="text-gray-400">No live streams right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <Link key={stream.id} to={`/stream/${stream.id}`} className="bg-gray-900 rounded-xl overflow-hidden hover:transform hover:scale-105 transition">
                <div className="aspect-video bg-gradient-to-br from-purple-600 to-pink-500 relative">
                  <span className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">LIVE</span>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold">{stream.title}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{stream.description}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}