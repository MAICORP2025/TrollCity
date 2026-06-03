import React from 'react'
import BroadcastChat from '@/components/broadcast/BroadcastChat'

export default function HytroViewerLayoutMobile({ stream, currentUser, allowJoinBattle }: any) {
  return (
    <div className="min-h-screen bg-[#05080f] text-white">
      <header className="px-4 pt-6 pb-3">
        <h2 className="text-lg font-black">{stream.title || 'Live Stream'}</h2>
        <div className="text-xs text-slate-400">{stream.current_viewers?.toLocaleString()} viewers</div>
      </header>

      <main className="px-4 pb-20">
        <div className="w-full aspect-video rounded-lg bg-black mb-4 flex items-center justify-center">Video player placeholder</div>

        <div className="rounded-2xl border border-white/6 bg-black/40 p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-800" />
            <div>
              <div className="font-black">{stream?.broadcaster_username || 'Host'}</div>
              <div className="text-xs text-slate-400">{stream.category || 'Gaming'}</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-slate-300">{stream.description || 'No description provided.'}</div>
        </div>

        <div className="rounded-2xl border border-white/6 bg-black/50 p-3">
          <div className="text-xs font-black uppercase text-slate-400">Live Chat</div>
          <div className="mt-3 h-64 overflow-hidden rounded-md">
            <BroadcastChat streamId={stream.id} hostId={stream.user_id} isViewer={true} isHost={false} />
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">Battles disabled for HytroGaming viewers.</div>
      </main>
    </div>
  )
}
