import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { useSearchParams, useNavigate } from 'react-router-dom'
import InboxSidebar from './tcps/components/InboxSidebar'
import ChatWindow from './tcps/components/ChatWindow'
import NewMessageModal from './tcps/components/NewMessageModal'
import CreateGroupChatModal from './tcps/components/CreateGroupChatModal'
import GroupChatInfoModal from './tcps/components/GroupChatInfoModal'
import IncomingCallPopup from '../components/IncomingCallPopup'
import { supabase } from '../lib/supabase'
import { usePresenceStore } from '../lib/presenceStore'
import { useQueryClient } from '@tanstack/react-query'
import { useConversations, usePrefetchMessages } from '../hooks/useOptimizedChat'
import { MessageSquare, Radio, ShieldCheck, Sparkles } from 'lucide-react'

const MOBILE_BREAKPOINT_PX = 768

interface SidebarConversation {
  other_user_id: string
  other_username: string
  other_avatar_url: string | null
  last_message: string
  last_timestamp: string
  unread_count: number
  is_online?: boolean
  rgb_username_expires_at?: string | null
}

export default function TCPS() {
  const { user } = useAuthStore()
  const { onlineUserIds } = usePresenceStore()
  const safeOnlineUserIds = onlineUserIds ?? []
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useConversations()
  usePrefetchMessages()

  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [activeConversationType, setActiveConversationType] = useState<'dm' | 'group'>('dm')
  const [activeGroupInfo, setActiveGroupInfo] = useState<{ conversationId: string; name: string } | null>(null)

  const [activeTab, setActiveTab] = useState<string>('inbox')
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false)

  const [otherUserInfo, setOtherUserInfo] = useState<{
    id: string
    username: string
    avatar_url: string | null
    created_at?: string
    is_online?: boolean
    rgb_username_expires_at?: string | null
    glowing_username_color?: string | null
  } | null>(null)

  const [incomingCall, setIncomingCall] = useState<{
    callerId: string
    callerUsername: string
    callerAvatar: string | null
    callType: 'audio' | 'video'
    roomId: string
  } | null>(null)

  useEffect(() => {
    const param = searchParams.get('user')
    if (!param || param === 'null' || param === 'undefined') return

    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
    if (!looksLikeUuid) return

    setActiveConversation(param)
    setOtherUserInfo({
      id: param,
      username: '',
      avatar_url: null,
    })
  }, [searchParams])

  useEffect(() => {
    if (!user?.id) return

    const callChannel = supabase
      .channel(`calls:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as any

          if (notification.type === 'call' && notification.metadata) {
            const metadata = notification.metadata

            setIncomingCall({
              callerId: metadata.caller_id,
              callerUsername: metadata.caller_username || 'Unknown',
              callerAvatar: metadata.caller_avatar || null,
              callType: metadata.call_type || 'audio',
              roomId: metadata.room_id,
            })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(callChannel)
    }
  }, [user?.id])

  const handleAcceptCall = () => {
    if (!incomingCall) return

    navigate(`/call/${incomingCall.roomId}/${incomingCall.callType}/${incomingCall.callerId}`)
    setIncomingCall(null)
  }

  const handleDeclineCall = async () => {
    if (!incomingCall || !user?.id) return

    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'call')
      .contains('metadata', { room_id: incomingCall.roomId })

    try {
      await supabase.from('call_history').insert({
        caller_id: incomingCall.callerId,
        receiver_id: user.id,
        room_id: incomingCall.roomId,
        type: incomingCall.callType,
        duration_minutes: 0,
        ended_at: new Date().toISOString(),
      })
    } catch {}

    setIncomingCall(null)
  }

  useEffect(() => {
    if (!activeConversation) return
    if (otherUserInfo?.id === activeConversation && otherUserInfo.username) return

    supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, created_at, rgb_username_expires_at, glowing_username_color')
      .eq('id', activeConversation)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return

        const resolvedName = data.display_name || data.username || `user${data.id.slice(0, 6)}`

        setOtherUserInfo({
          id: data.id,
          username: resolvedName,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
          rgb_username_expires_at: data.rgb_username_expires_at,
          glowing_username_color: data.glowing_username_color,
        })
      })
  }, [activeConversation, otherUserInfo?.id, otherUserInfo?.username])

  const handleSelectConversation = (
    otherId: string,
    isGroup?: boolean,
    conversationId?: string,
    groupName?: string
  ) => {
    setActiveConversation(otherId)
    setActiveConversationType(isGroup ? 'group' : 'dm')

    if (isGroup && conversationId) {
      setActiveGroupInfo({ conversationId, name: groupName || 'Group Chat' })
    } else {
      setActiveGroupInfo(null)
    }

    setOtherUserInfo({
      id: otherId,
      username: '',
      avatar_url: null,
    })

    navigate(`/tcps?user=${otherId}`, { replace: true })
  }

  const handleNewMessage = (userId: string) => {
    setActiveConversation(userId)
    setActiveConversationType('dm')
    setActiveGroupInfo(null)
    setOtherUserInfo({
      id: userId,
      username: '',
      avatar_url: null,
    })
    navigate(`/tcps?user=${userId}`, { replace: true })
    setShowNewMessageModal(false)
  }

  const handleGroupCreated = (conversationId: string) => {
    setSidebarRefreshKey((prev) => prev + 1)
    setActiveConversation(conversationId)
    setActiveConversationType('group')
    setActiveGroupInfo({ conversationId, name: '' })
    navigate(`/tcps?user=${conversationId}`, { replace: true })
    setShowCreateGroupModal(false)
  }

  const handleLeftGroup = () => {
    setActiveConversation(null)
    setActiveConversationType('dm')
    setActiveGroupInfo(null)
    setOtherUserInfo(null)
    navigate('/tcps', { replace: true })
    setSidebarRefreshKey((prev) => prev + 1)
  }

  const handleConversationsLoaded = useCallback(
    (conversations: SidebarConversation[]) => {
      if (conversations && conversations.length > 0) {
        const userParam = searchParams.get('user')
        const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= MOBILE_BREAKPOINT_PX : true

        if (isDesktop && !activeConversation && !userParam) {
          const first = conversations[0]
          setActiveConversation(first.other_user_id)
          navigate(`/tcps?user=${first.other_user_id}`, { replace: true })
        }
      }
    },
    [activeConversation, navigate, searchParams]
  )

  const onlineUsersRecord = safeOnlineUserIds.reduce<Record<string, boolean>>((acc, id) => {
    acc[id] = true
    return acc
  }, {})

  const isOtherOnline = otherUserInfo ? safeOnlineUserIds.includes(otherUserInfo.id) : false

  return (
    <div className="relative h-[calc(100dvh-var(--bottom-nav-height,64px)-env(safe-area-inset-bottom,0px))] w-full overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex h-full flex-col px-3 py-3 md:px-6 md:py-6">
        <div className="mb-4 hidden items-center justify-between gap-4 md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-purple-700 via-cyan-500 to-pink-600 shadow-[0_0_28px_rgba(45,212,191,0.25)]">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>

            <div>
              <h1 className="bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-3xl font-black text-transparent">
                TCPS
              </h1>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
                Troll City Postal Service
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            <div className="flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-4 py-2 text-cyan-200">
              <Radio className="h-4 w-4" />
              {safeOnlineUserIds.length} Online
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-4 py-2 text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              Secure Mail
            </div>

            <div className="flex items-center gap-2 rounded-full border border-pink-300/15 bg-pink-400/10 px-4 py-2 text-pink-200">
              <Sparkles className="h-4 w-4" />
              City OS
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_0%_0%,rgba(45,212,191,0.10),transparent_45%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_100%_100%,rgba(236,72,153,0.08),transparent_45%)]" />

          <div
            className={`relative z-10 h-full w-full flex-col border-cyan-400/10 bg-slate-950/45 md:w-80 md:border-r lg:w-96 ${
              activeConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            <InboxSidebar
              activeConversation={activeConversation}
              onSelectConversation={handleSelectConversation}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onlineUsers={onlineUsersRecord}
              onConversationsLoaded={handleConversationsLoaded}
              onOpenNewMessage={() => setShowNewMessageModal(true)}
              onOpenCreateGroup={() => setShowCreateGroupModal(true)}
              refreshKey={sidebarRefreshKey}
            />
          </div>

          <div
            className={`relative z-10 h-full min-w-0 flex-1 flex-col bg-black/10 ${
              !activeConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            <ChatWindow
              conversationId={null}
              otherUserInfo={activeConversationType === 'group' ? null : otherUserInfo}
              isOnline={activeConversationType === 'group' ? undefined : isOtherOnline}
              isGroup={activeConversationType === 'group'}
              groupConversationId={activeGroupInfo?.conversationId || null}
              groupName={activeGroupInfo?.name || null}
              onBack={() => {
                setActiveConversation(null)
                setActiveConversationType('dm')
                setActiveGroupInfo(null)
                navigate('/tcps')
              }}
              onMessageSent={() => {
                setSidebarRefreshKey((prev) => prev + 1)
              }}
              onOpenGroupInfo={() => setShowGroupInfoModal(true)}
            />
          </div>
        </div>
      </div>

      <NewMessageModal
        isOpen={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onSelectUser={handleNewMessage}
      />

      <CreateGroupChatModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={handleGroupCreated}
      />

      {showGroupInfoModal && activeGroupInfo && (
        <GroupChatInfoModal
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          conversationId={activeGroupInfo.conversationId}
          groupName={activeGroupInfo.name || 'Group Chat'}
          onLeftGroup={handleLeftGroup}
          onMemberChanged={() => setSidebarRefreshKey((prev) => prev + 1)}
        />
      )}

      {incomingCall && (
        <IncomingCallPopup
          isOpen={!!incomingCall}
          callerId={incomingCall.callerId}
          callerUsername={incomingCall.callerUsername}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.callType}
          roomId={incomingCall.roomId}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
    </div>
  )
}