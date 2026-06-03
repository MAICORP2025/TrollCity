import React from 'react'
import { Circle, Square, Loader2, Save, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SaveBroadcastButtonProps {
  isRecording: boolean
  isUploading: boolean
  recordingDuration: number
  hasRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onUploadRecording: () => void
  className?: string
}

export function SaveBroadcastButton({
  isRecording,
  isUploading,
  recordingDuration,
  hasRecording,
  onStartRecording,
  onStopRecording,
  onUploadRecording,
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
        Uploading recording...
      </button>
    )
  }

  if (isRecording) {
    return (
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
    )
  }

  if (hasRecording) {
    return (
      <button
        onClick={onUploadRecording}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-black text-emerald-200 transition hover:bg-emerald-500/20',
          className,
        )}
      >
        <Upload className="h-4 w-4" />
        Save Recording
      </button>
    )
  }

  return (
    <button
      onClick={onStartRecording}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/[0.08]',
        className,
      )}
    >
      <Save className="h-4 w-4" />
      Save Broadcast
    </button>
  )
}

export default SaveBroadcastButton
