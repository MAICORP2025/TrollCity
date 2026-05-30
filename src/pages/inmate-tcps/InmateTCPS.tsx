import { useState } from 'react'
import { useAuthStore } from '../../lib/store'
import { useJailMode } from '../../hooks/useJailMode'
import InmateChatSidebar from './components/InmateChatSidebar'
import InmateChatWindow from './components/InmateChatWindow'
import { Mail, Lock, AlertTriangle } from 'lucide-react'

export default function InmateTCPS() {
  const { user, profile } = useAuthStore()
  const { isJailed } = useJailMode(user?.id)

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeOtherUserId, setActiveOtherUserId] = useState<string | null>(null)
  const [activeOtherUsername, setActiveOtherUsername] = useState<string | null>(null)
  const [activeOtherAvatarUrl, setActiveOtherAvatarUrl] = useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  const handleSelectConversation = (
    conversationId: string,
    otherUserId: string,
    otherUsername: string,
    otherAvatarUrl: string | null
  ) => {
    setActiveConversationId(conversationId)
    setActiveOtherUserId(otherUserId)
    setActiveOtherUsername(otherUsername)
    setActiveOtherAvatarUrl(otherAvatarUrl)
  }

  if (!isJailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
            <Lock className="h-10 w-10 text-zinc-500" />
          </div>
          <h1 className="text-2xl font-black text-zinc-200">Inmate Mail Locked</h1>
          <p className="mt-2 text-sm text-zinc-500">
            This messaging system is only available to incarcerated users. You are not currently in jail.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-var(--bottom-nav-height,64px)-env(safe-area-inset-bottom,0px))] w-full flex-col overflow-hidden bg-black text-white">
      <div className="flex items-center gap-3 border-b border-red-950 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/50">
          <Mail className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-black text-zinc-100">Inmate Mail</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500/80">Monitored & recorded</p>
        </div>
        {isJailed && (
          <div className="flex items-center gap-1.5 rounded-full border border-yellow-700/40 bg-yellow-950/40 px-3 py-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-yellow-400">Inmate Mode</span>
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`h-full w-full md:w-80 lg:w-96 ${
            activeConversationId ? 'hidden md:flex md:flex-col' : 'flex flex-col'
          }`}
        >
          <InmateChatSidebar
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            refreshKey={sidebarRefreshKey}
          />
        </div>

        <div
          className={`h-full min-w-0 flex-1 ${
            activeConversationId ? 'flex flex-col' : 'hidden md:flex md:flex-col'
          }`}
        >
          <InmateChatWindow
            conversationId={activeConversationId}
            otherUserId={activeOtherUserId}
            otherUsername={activeOtherUsername}
            otherAvatarUrl={activeOtherAvatarUrl}
            onBack={() => setActiveConversationId(null)}
            onMessageSent={() => setSidebarRefreshKey((prev) => prev + 1)}
          />
        </div>
      </div>
    </div>
  )
}
