import LiveStreamTile from './LiveStreamTile'
import EmptyState from './EmptyState'
import type { XTrollzStream } from '@/lib/xtrollz'
import type { ViewerTab } from '@/lib/xtrollz'

interface LiveStreamGridProps {
  streams: XTrollzStream[]
  tab: ViewerTab
  onStreamClick: (streamId: string) => void
  onOpenSubscription?: (streamerId: string, streamerName: string) => void
}

export default function LiveStreamGrid({ streams, tab, onStreamClick, onOpenSubscription }: LiveStreamGridProps) {
  if (tab !== 'live_now') return null
  if (streams.length === 0) return <EmptyState />

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {streams.map((stream) => (
        <LiveStreamTile
          key={stream.id}
          stream={stream}
          onClick={() => onStreamClick(stream.id)}
          onOpenSubscription={onOpenSubscription}
        />
      ))}
    </div>
  )
}
