import React from 'react'
import BroadcastChat from '@/components/broadcast/BroadcastChat'
import AudienceBubbleTicker from '@/components/broadcast/AudienceBubbleTicker'

export default function HytroViewerLayoutDesktop({ stream, currentUser, allowJoinBattle }: any) {
  return (
    <div className="min-h-screen bg-[#05080f] text-white">
      <header className="bg-transparent px-6 py-4">
        <div className="mx-auto max-w-7xl"> 
          <h1 className="text-xl font-black">{stream.title || 'Live Gaming Stream'}</h1>
          <div className="text-sm text-slate-400">{stream.current_viewers?.toLocaleString()} viewers • {stream.started_at ? `Uptime: ${stream.started_at}` : ''}</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl grid grid-cols-3 gap-6 px-6 pb-12">
        {/* Left: Video area (large) */}
        <section className="col-span-2 rounded-2xl bg-black/60 p-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            {/* Placeholder for HLS/Player or LiveKit player - integrator should mount real player here */}
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">Video player placeholder</div>
            {/* Host camera inset */}
            <div className="absolute right-6 top-6 w-48 rounded-xl border border-white/10 bg-black/40 p-2">
              <div className="h-24 w-full rounded-md bg-slate-900" />
              <div className="mt-2 text-xs font-black">{stream?.broadcaster_username || 'Host'}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="col-span-2 rounded-2xl border border-white/6 bg-black/40 p-4">
              <h3 className="text-sm font-black">About This Stream</h3>
              <p className="mt-2 text-sm text-slate-300">{stream.description || 'No description provided.'}</p>
            </div>

            <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
              <h3 className="text-sm font-black">Top Fans</h3>
              <ol className="mt-2 text-sm text-slate-300">{/* placeholder */}
                <li>1. NeoNinja</li>
                <li>2. PixelQueen</li>
                <li>3. CyberWolf</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Right: Chat / Sidebar */}
        <aside className="col-span-1 flex flex-col gap-4">
          <div className="rounded-2xl border border-white/6 bg-black/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase text-slate-400">Live Chat</div>
                <div className="text-sm text-slate-200">Join the conversation</div>
              </div>
              <div className="text-xs text-slate-400">{stream.current_viewers?.toLocaleString()} viewers</div>
            </div>

            <div className="mt-3 h-[480px] overflow-hidden rounded-md">
              <BroadcastChat streamId={stream.id} hostId={stream.user_id} isViewer={true} isHost={false} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-black/40 p-3">
            <h4 className="text-sm font-black">Battle (View Only)</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-gradient-to-b from-cyan-700/10 to-transparent p-3">
                <div className="text-xs font-black text-cyan-300">Team Troll</div>
                <div className="mt-1 text-xl font-black">12,450</div>
              </div>
              <div className="rounded-lg bg-gradient-to-b from-purple-700/10 to-transparent p-3">
                <div className="text-xs font-black text-purple-300">Team Beast</div>
                <div className="mt-1 text-xl font-black">9,870</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-400">Battle is view-only for HytroGaming viewers.</div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-black/40 p-3">
            <h4 className="text-sm font-black">Stream Health</h4>
            <div className="mt-2 text-sm text-slate-300">1080p60 • 38ms • Excellent</div>
          </div>
        </aside>
      </main>

      <footer className="fixed bottom-4 left-0 right-0 pointer-events-none">
        <div className="mx-auto max-w-7xl px-6">
          <AudienceBubbleTicker streamId={stream.id} audience={[]} currentUserId={currentUser?.id} hostUserId={stream.user_id} />
        </div>
      </footer>
    </div>
  )
}
