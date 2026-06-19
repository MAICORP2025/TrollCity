import React from 'react'
import { Circle, Square, Loader2, Save, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SaveBroadcastButtonProps {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  streamId: string | null
  onStartRecording: (streamId: string) => void
  onStopRecording: () => void
  onSaveClip?: () => void
  className?: string
}

export function SaveBroadcastButton({
  isRecording,
  isUploading,
  recordingDuration,
  streamId,
  onStartRecording,
  onStopRecording,
  onSaveClip,
  className,
}: SaveBroadcastButtonProps) {
  const minutes = Math.floor(recordingDuration / 60)
  const seconds = recordingDuration % 60

  if (isUploading) {
    return (
      <button
        disabled
        className={cn(
          'flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-200',
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving...
      </button>
    )
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        {onSaveClip && (
          <button
            onClick={onSaveClip}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/25',
              className,
            )}
            title="Save last 60 seconds as clip"
          >
            <Scissors className="h-3.5 w-3.5" />
            Clip
          </button>
        )}
        <button
          onClick={onStopRecording}
          className={cn(
            'flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2.5 text-xs font-black text-red-200 transition hover:bg-red-500/25',
            className,
          )}
        >
          <span className="relative">
            <Circle className="h-3.5 w-3.5 fill-red-400 text-red-400 animate-pulse" />
          </span>
          REC {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        if (streamId) onStartRecording(streamId)
      }}
      disabled={!streamId}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
    >
      <Save className="h-4 w-4" />
      Record Stream
    </button>
  )
}

export default SaveBroadcastButton