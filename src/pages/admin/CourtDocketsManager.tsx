import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Gavel, Calendar, Users, AlertCircle } from 'lucide-react'

export default function CourtDocketsManager() {
  const [dockets, setDockets] = useState<any[]>([])
  const [selectedDocket, setSelectedDocket] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [warrants, setWarrants] = useState<any[]>([])

  useEffect(() => {
    loadDockets()
    loadActiveWarrants()
  }, [])

  useEffect(() => {
    if (selectedDocket) {
      loadCases(selectedDocket.id)
    }
  }, [selectedDocket])

  const loadDockets = async () => {
    const { data } = await supabase
      .from('court_dockets')
      .select('*')
      .order('court_date', { ascending: false })
    if (data) setDockets(data)
  }

  const loadCases = async (docketId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(username, avatar_url),
        plaintiff:plaintiff_id(username)
      `)
      .eq('docket_id', docketId)
      .order('created_at', { ascending: false })
    if (data) setCases(data)
    setLoading(false)
  }

  const loadActiveWarrants = async () => {
    const { data } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(username, avatar_url)
      `)
      .eq('warrant_active', true)
      .order('created_at', { ascending: false })
    if (data) setWarrants(data)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Active Warrants Section */}
      {warrants.length > 0 && (
        <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            Active Warrants
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warrants.map(w => (
              <div key={w.id} className="bg-black/40 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">{w.defendant?.username || 'Unknown'}</div>
                  <div className="text-xs text-red-300 mt-1">{w.reason}</div>
                  <div className="text-xs text-gray-500 mt-2">Issued: {new Date(w.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-red-500 text-xs font-bold px-2 py-1 bg-red-900/20 rounded border border-red-900/50">
                  WARRANT
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dockets List */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-[600px] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Court Dockets
          </h2>
          <div className="space-y-2">
            {dockets.map(docket => (
              <div 
                key={docket.id}
                onClick={() => setSelectedDocket(docket)}
                className={`p-4 rounded-lg cursor-pointer transition border ${
                  selectedDocket?.id === docket.id 
                    ? 'bg-purple-900/20 border-purple-500/50' 
                    : 'bg-black/20 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white">{new Date(docket.court_date).toLocaleDateString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    docket.status === 'open' ? 'bg-green-500/20 text-green-400' :
                    docket.status === 'full' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-zinc-500/20 text-gray-400'
                  }`}>
                    {docket.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Max Cases: {docket.max_cases}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Docket Cases */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-[600px] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-purple-400" />
            Docket Cases {selectedDocket && `- ${new Date(selectedDocket.court_date).toLocaleDateString()}`}
          </h2>

          {!selectedDocket ? (
            <div className="text-gray-500 text-center py-10">Select a docket to view cases</div>
          ) : loading ? (
            <div className="text-gray-500 text-center py-10">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="text-gray-500 text-center py-10">No cases in this docket</div>
          ) : (
            <div className="space-y-3">
              {cases.map(c => (
                <div key={c.id} className="bg-black/20 border border-zinc-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden">
                         <img src={c.defendant?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.defendant?.username}`} alt="" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{c.defendant?.username}</div>
                        <div className="text-xs text-gray-400">Summoned by {c.plaintiff?.username}</div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded font-bold uppercase ${
                      c.status === 'warrant_issued' ? 'bg-red-500/20 text-red-400' :
                      c.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </div>
                  </div>
                  
                  <div className="bg-black/30 p-3 rounded text-sm text-gray-300 mb-2">
                    <span className="text-gray-500 text-xs block mb-1">REASON</span>
                    {c.reason}
                  </div>

                  {c.users_involved && (
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Involved: {c.users_involved}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
