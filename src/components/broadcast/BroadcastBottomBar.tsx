import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ticket,
  Plus,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  MoreHorizontal,
  Radio,
  Power,
  MicIcon,
  Loader2,
  Gift,
  Sparkles,
} from 'lucide-react';
import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import GiftTray from './GiftTray';
import { GiftItem } from '../../lib/hooks/useGiftSystem';
import BroadcastOfficerModal from './BroadcastOfficerModal';
import { trollCityBroadcastTheme } from '../../styles/broadcastTheme'

/**
 * Generic "icon grid" button used in host action bottom bar.
 */
function HostActionButton({
  active,
  onClick,
  icon: Icon,
  label,
  variant = 'default',
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}) {
  const theme = trollCityBroadcastTheme
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[70px] min-w-[110px] flex-col items-center justify-center gap-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'default'
          ? theme.glassButton
          : theme.danger,
      )}
    >
      <Icon className={cn('h-6 w-6', variant === 'danger' && 'h-7 w-7')} />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

/** Open Stage Pass card — the large purple button in the bottom bar */
export function OpenStagePassCard({ onClick, label = 'Open Stage Pass' }: { onClick: () => void; label?: string }) {
  const theme = trollCityBroadcastTheme
  return (
    <button
      onClick={onClick}
      className={cn('flex h-[86px] items-center justify-center gap-4 rounded-2xl border text-xl font-black text-white shadow-[0_0_35px_rgba(168,85,247,0.5)] hover:scale-[1.01] transition-transform', theme.primaryButton, 'border-purple-400/50 hover:shadow-[0_0_45px_rgba(168,85,247,0.60)]')}
    >
      <Ticket className="h-8 w-8" />
      {label}
    </button>
  );
}

/** Stage Pass summary card — left card in the bottom bar */
export function StagePassSummaryCard({
  openPassCount,
  onManage,
}: {
  openPassCount: number;
  onManage: () => void;
}) {
  return (
    <div className={cn('flex h-[86px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-5 shadow-[0_0_18px_rgba(168,85,247,0.15)] backdrop-blur-2xl', trollCityBroadcastTheme.panel)}>
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-500/20 text-purple-300">
          <Ticket className="h-7 w-7" />
        </div>
        <div>
          <p className="text-base font-black text-white">Stage Pass</p>
          <p className="mt-1 text-sm font-black text-emerald-400">
            {openPassCount} Open
          </p>
        </div>
      </div>
      <button
        onClick={onManage}
        className={cn('rounded-xl px-5 py-2.5 text-sm font-bold text-white', theme.glassButton)}
      >
        Manage
      </button>
    </div>
  );
}

/**
 * BroadcastBottomBar
 *
 * Three cells:
 *   StagePassSummaryCard  (left, 290px)
 *   HostActionButtons     (center, fills remaining)
 *   OpenStagePassCard     (right, 360px)
 *
 * Handlers wired from BroadcastPage.tsx business logic.
 */
export interface BroadcastBottomBarProps {
  /* ─── data ─── */
  openPassCount: number;
  isMicOn: boolean;
  isCamOn: boolean;
  isLive: boolean;
  isGiftTrayOpen: boolean;
  isOfficerModalOpen: boolean;
  onToggleMic?: () => void;
  onToggleCam?: () => void;
  onGift?: () => void;
  onGiftRecipient?: (userId: string) => void;
  onShare?: () => void;
  onOpenMoreMenu?: () => void;
  onEndStream: () => void;
  onOpenStagePass: () => void;
  onManageStagePass: () => void;
  onOpenCoinStore?: () => void;
}

export default function BroadcastBottomBar({
  openPassCount,
  isMicOn,
  isCamOn,
  isLive,
  isGiftTrayOpen,
  isOfficerModalOpen,
  onToggleMic,
  onToggleCam,
  onGift,
  onShare,
  onOpenMoreMenu,
  onEndStream,
  onOpenStagePass,
  onManageStagePass,
  onOpenCoinStore,
}: BroadcastBottomBarProps) {
  return (
    <div className={cn(trollCityBroadcastTheme.bottomBarShell, 'relative')}>
      {/* Ambient glow strip */}
      <div className={trollCityBroadcastTheme.bottomBarAmbient} />

      <div className="grid gap-4" style={{ gridTemplateColumns: '290px 1fr 360px' }}>
        {/* Left: Stage Pass summary */}
        <StagePassSummaryCard
          openPassCount={openPassCount}
          onManage={onManageStagePass}
        />

        {/* Center: host action buttons */}
        <div className={trollCityBroadcastTheme.hostActionButtonCenter}>
          <HostActionButton
            active={isMicOn}
            onClick={onToggleMic}
            icon={isMicOn ? Mic : MicOff}
            label={isMicOn ? 'Mute' : 'Unmute'}
          />
          <HostActionButton
            active={isCamOn}
            onClick={onToggleCam}
            icon={isCamOn ? Video : VideoOff}
            label={isCamOn ? 'Turn Off' : 'Camera'}
          />
          <HostActionButton
            active={false}
            onClick={onShare}
            icon={Share2}
            label="Share"
          />
          <HostActionButton
            active={false}
            onClick={onOpenMoreMenu}
            icon={MoreHorizontal}
            label="More"
          />
          {/* End Stream — red variant */}
          <button
            onClick={onEndStream}
            className={cn('flex h-[70px] min-w-[150px] flex-col items-center justify-center gap-2 rounded-xl transition-all', theme.danger)}
          >
            <Radio className="h-7 w-7" />
            <span className="text-sm font-black">End Stream</span>
          </button>
        </div>

        {/* Right: large Stage Pass open button */}
        <OpenStagePassCard onClick={onOpenStagePass} />
      </div>
    </div>
  );
}

/**
 * BroadcastFooterStrip
 *
 * Bottom-of-page one-line status bar.
 */
export function BroadcastFooterStrip({
  viewerCount,
  connectionQuality = 'Excellent',
  onLicenseClick,
}: {
  viewerCount: number;
  connectionQuality?: string;
  onLicenseClick?: () => void;
}) {
  return (
    <footer className={theme.footerStrip}>
      <span className="flex items-center gap-2 text-slate-400">
        <Sparkles className="h-4 w-4 text-purple-400" />
        Stream protected
      </span>
      <span className="text-white/15">•</span>
      <span>
        <button
          onClick={onLicenseClick}
          className="hover:text-slate-200 transition-colors"
          title="Your stream license"
        >
          {viewerCount >= 1000 ? `${(viewerCount / 1000).toFixed(1)}K` : viewerCount} watching
        </button>
      </span>
      <span className="text-white/15">•</span>
      <span>Troll City Guidelines</span>
      <span className="text-white/15">•</span>
      <span className="text-emerald-400">{connectionQuality} Connection</span>
    </footer>
  );
}
