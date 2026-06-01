// ============================================================
// Broadcast Text Popup Types
// ============================================================

export type PopupStyle = 'default' | 'urgent' | 'battle' | 'hype';

export type PopupDuration = 5000 | 10000 | 15000 | 30000;

export interface BroadcastTextPopupPayload {
  id: string;
  stream_id: string;
  sender_id: string;
  sender_username?: string;
  message: string;
  style: PopupStyle;
  duration_ms: number;
  created_at: string;
}

export const POPUP_STYLE_CONFIG: Record<
  PopupStyle,
  {
    label: string;
    glowColor: string;
    borderColor: string;
    bgGradient: string;
    textColor: string;
    iconEmoji: string;
  }
> = {
  default: {
    label: 'Default',
    glowColor: 'shadow-[0_0_30px_rgba(34,211,238,0.4)]',
    borderColor: 'border-cyan-400/40',
    bgGradient: 'from-cyan-950/90 via-slate-950/90 to-blue-950/90',
    textColor: 'text-cyan-100',
    iconEmoji: '💬',
  },
  urgent: {
    label: 'Urgent',
    glowColor: 'shadow-[0_0_30px_rgba(239,68,68,0.4)]',
    borderColor: 'border-red-400/40',
    bgGradient: 'from-red-950/90 via-slate-950/90 to-orange-950/90',
    textColor: 'text-red-100',
    iconEmoji: '🚨',
  },
  battle: {
    label: 'Battle',
    glowColor: 'shadow-[0_0_30px_rgba(168,85,247,0.4)]',
    borderColor: 'border-purple-400/40',
    bgGradient: 'from-purple-950/90 via-slate-950/90 to-pink-950/90',
    textColor: 'text-purple-100',
    iconEmoji: '⚔️',
  },
  hype: {
    label: 'Hype',
    glowColor: 'shadow-[0_0_30px_rgba(34,197,94,0.4)]',
    borderColor: 'border-green-400/40',
    bgGradient: 'from-green-950/90 via-slate-950/90 to-cyan-950/90',
    textColor: 'text-green-100',
    iconEmoji: '🔥',
  },
};

export const POPUP_DURATIONS: { label: string; value: PopupDuration }[] = [
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
];

export const MAX_POPUP_MESSAGE_LENGTH = 160;
