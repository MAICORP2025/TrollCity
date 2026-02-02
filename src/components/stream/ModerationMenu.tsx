import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import IPBanModal from '../officer/IPBanModal'

interface ModerationMenuProps {
  target: { userId: string; username: string; x: number; y: number }
  streamId: string
  onClose: () => void
  onActionComplete: () => void
}

export default function ModerationMenu({ 
  target, 
  streamId, 
  onClose, 
  onActionComplete
}: ModerationMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showIPBanModal, setShowIPBanModal] = useState(false)
  const [targetIP, setTargetIP] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true;
    supabase.functions.invoke('officer-actions', {
      body: { action: 'get_moderation_context', streamId }
    }).then(({ data, error }) => {
      if (mounted && !error && data?.success) {
        // Permissions logic removed as it was unused
      }
    })
    return () => { mounted = false }
  }, [streamId])


  const handleAction = async (
    actionType: 'mute' | 'block' | 'report' | 'restrict_live' | 'unmute',
    duration?: number
  ) => {
    try {
      switch (actionType) {
        case 'mute': {
          const muteDurationMs = duration || 10 * 60 * 1000
          const muteMinutes = Math.round(muteDurationMs / 60000)
          
          const { error } = await supabase.functions.invoke('officer-actions', {
            body: {
              action: 'troll_mic_mute',
              targetUserId: target.userId,
              targetUsername: target.username,
              streamId,
              durationMinutes: muteMinutes
            }
          })

          if (error) throw error

          toast.success(
            `Muted ${target.username}'s microphone for ${muteMinutes} minute${
              muteMinutes === 1 ? '' : 's'
            }.`
          )
          break
        }
        case 'unmute': {
          const { error } = await supabase.functions.invoke('officer-actions', {
            body: {
              action: 'troll_mic_unmute',
              targetUserId: target.userId,
              targetUsername: target.username,
              streamId
            }
          })

          if (error) throw error

          toast.success(`Unmuted ${target.username}'s microphone.`)
          break
        }
        case 'restrict_live': {
          const restrictDurationMs = duration || 60 * 60 * 1000
          const restrictMinutes = Math.round(restrictDurationMs / 60000)
          
          const { error } = await supabase.functions.invoke('officer-actions', {
            body: {
              action: 'restrict_live',
              targetUserId: target.userId,
              targetUsername: target.username,
              streamId,
              durationMinutes: restrictMinutes
            }
          })

          if (error) throw error

          toast.success(
            `Restricted ${target.username} from going live for ${restrictMinutes} minute${
              restrictMinutes === 1 ? '' : 's'
            }.`
          )
          break
        }
        case 'block': {
          const { error } = await supabase.functions.invoke('officer-actions', {
            body: {
              action: 'troll_immunity', // Handles no_ban_until (block)
              targetUserId: target.userId,
              targetUsername: target.username,
              streamId
            }
          })

          if (error) throw error

          toast.success(`Blocked ${target.username} from bans for 24 hours.`)
          break
        }
        case 'report': {
          const { error } = await supabase.functions.invoke('officer-actions', {
            body: {
              action: 'report_troll_attack',
              targetUserId: target.userId,
              targetUsername: target.username,
              streamId,
              description: `Officer report for ${target.username} in stream ${streamId}`
            }
          })

          if (error) throw error

          toast.success(`Report filed for ${target.username}`)
          break
        }
        default:
          break
      }

      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Error performing moderation action:', err)
      // Check for custom error message from Edge Function
      const msg = err?.context?.json?.error || err?.message || 'Failed to perform action';
      // If it's a "Forbidden" or "Insufficient funds" error, it will come through here.
      if (msg.includes('Insufficient funds')) {
         toast.error(msg);
      } else {
         toast.error(msg);
      }
    }
  }

  const handleKick = async () => {
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'troll_kick',
          targetUserId: target.userId,
          targetUsername: target.username,
          streamId
        }
      })

      if (error) throw error

      toast.success(`${target.username} was kicked.`)

      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Error kicking user:', err)
      const msg = err?.context?.json?.error || err?.message || 'Failed to kick user';
      toast.error(msg)
    }
  }

  const banUser = async () => {
    try {
      const reason = window.prompt(`Reason for warrant against ${target.username}?`, 'Violation of rules')
      if (!reason || !reason.trim()) {
        // Cancelled or empty
        return
      }
      
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'issue_warrant',
          targetUserId: target.userId,
          targetUsername: target.username,
          reason: reason.trim()
        }
      })

      if (error) throw error

      toast.success(`Warrant issued for ${target.username}. Access restricted until court appearance.`)
      onActionComplete()
      onClose()
    } catch (err: any) {
      console.error('Warrant issuance failed:', err)
      const msg = err?.context?.json?.error || err?.message || 'Failed to issue warrant';
      toast.error(msg)
    }
  }

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${target.y}px`,
    left: `${target.x}px`,
    zIndex: 10000
  }

  return (
    <>
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-black/95 backdrop-blur-md border-2 border-purple-500 rounded-lg shadow-2xl p-2 min-w-[200px]"
    >
      <div className="text-xs text-purple-300 mb-2 px-2 py-1 border-b border-purple-500/30">
        Moderation: {target.username}
      </div>
      
      <button
        onClick={handleKick}
        className="w-full text-left px-3 py-2 hover:bg-red-500/20 rounded text-red-400 flex items-center gap-2 transition-colors"
      >
        Kick User
      </button>
      
      <div className="space-y-2 mt-3 border-t border-white/10 pt-2">
        <div className="text-[11px] uppercase tracking-wider text-gray-400 px-2">
          Microphone mute (global)
        </div>
        <div className="flex gap-1 px-1">
          <button
            onClick={() => handleAction('mute', 10 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 transition"
          >
            10m
          </button>
          <button
            onClick={() => handleAction('mute', 30 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 transition"
          >
            30m
          </button>
          <button
            onClick={() => handleAction('mute', 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 transition"
          >
            60m
          </button>
        </div>
        <button
          onClick={() => handleAction('unmute')}
          className="w-full text-left px-3 py-2 hover:bg-green-500/20 rounded text-green-400 flex items-center gap-2 transition-colors text-xs"
        >
           Unmute Microphone
        </button>

        <div className="text-[11px] uppercase tracking-wider text-gray-400 px-2 pt-2">
          Restrict from going live
        </div>
        <div className="flex gap-1 px-1">
          <button
            onClick={() => handleAction('restrict_live', 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-gray-400 transition"
          >
            1h
          </button>
          <button
            onClick={() => handleAction('restrict_live', 6 * 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-gray-400 transition"
          >
            6h
          </button>
          <button
            onClick={() => handleAction('restrict_live', 24 * 60 * 60 * 1000)}
            className="flex-1 text-xs py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-gray-400 transition"
          >
            24h
          </button>
        </div>

        <button
          onClick={banUser}
          className="w-full text-left px-3 py-2 hover:bg-red-600/20 rounded text-red-300 flex items-center gap-2 transition-colors font-semibold"
        >
          Issue Warrant (Restrict Access)
        </button>

        <button
          onClick={() => handleAction('block')}
          className="w-full text-left px-3 py-2 hover:bg-orange-500/20 rounded text-orange-400 flex items-center gap-2 transition-colors"
        >
          Block for 24h
        </button>

        <button
          onClick={() => handleAction('report')}
          className="w-full text-left px-3 py-2 hover:bg-purple-500/20 rounded text-purple-400 flex items-center gap-2 transition-colors"
        >
          Report Troll Attack
        </button>

        <button
          onClick={() => {
            window.open(`/admin/user-history/${target.userId}`, '_blank')
            onClose()
          }}
          className="w-full text-left px-3 py-2 hover:bg-blue-500/20 rounded text-blue-400 flex items-center gap-2 transition-colors"
        >
          View offense history
        </button>
      </div>

      <div className="border-t border-purple-500/30 my-2"></div>

      <button
        onClick={() => {
          setShowIPBanModal(true)
        }}
        className="w-full text-left px-3 py-2 hover:bg-red-600/30 rounded text-red-400 flex items-center gap-2 transition-colors font-semibold"
      >
        🚫 Ban IP Address
      </button>
    </div>
    {showIPBanModal && (
      <IPBanModal
        isOpen={showIPBanModal}
        onClose={() => {
          setShowIPBanModal(false)
          setTargetIP(null)
        }}
        onSuccess={() => {
          onActionComplete()
          onClose()
        }}
        targetUserId={target.userId}
        targetUsername={target.username}
        targetIP={targetIP || undefined}
      />
    )}
    </>
  )
}

