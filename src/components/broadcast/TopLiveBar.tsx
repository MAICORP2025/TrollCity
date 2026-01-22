import React from 'react';
import { Eye, MoreVertical } from 'lucide-react';

interface TopLiveBarProps {
  isLive: boolean;
  timer: string; // Format: "00:01:17"
  viewerCount: number;
  onMoreClick: () => void;
  className?: string;
}

export default function TopLiveBar({
  isLive,
  timer,
  viewerCount,
  onMoreClick,
  className = ''
}: TopLiveBarProps) {
  return (
    <div className={`broadcast-top-bar ${className}`}>
      {/* Live Badge + Timer */}
      {isLive && (
        <div className="broadcast-live-badge">
          <div className="broadcast-live-badge-dot"></div>
          <span>LIVE</span>
        </div>
      )}

      {/* Timer */}
      <div className="broadcast-timer">{timer}</div>

      {/* Spacer */}
      <div className="broadcast-top-spacer"></div>

      {/* Viewer Count */}
      <div className="broadcast-viewer-count">
        <Eye className="broadcast-viewer-icon" />
        <span>{viewerCount.toLocaleString()}</span>
      </div>

      {/* More Menu Button */}
      <button
        className="broadcast-more-button"
        onClick={onMoreClick}
        aria-label="More options"
      >
        <MoreVertical size={18} />
      </button>
    </div>
  );
}
