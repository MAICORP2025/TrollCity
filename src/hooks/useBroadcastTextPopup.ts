import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { generateUUID } from '@/lib/uuid';
import type {
  BroadcastTextPopupPayload,
  PopupStyle,
} from '@/types/textPopup';

interface UseBroadcastTextPopupOptions {
  streamId: string;
  currentUserId: string | undefined;
  currentUsername?: string;
  canSend: boolean;
}

interface UseBroadcastTextPopupReturn {
  activePopup: BroadcastTextPopupPayload | null;
  sendPopup: (
    message: string,
    style: PopupStyle,
    durationMs: number,
  ) => Promise<void>;
  sending: boolean;
}

export function useBroadcastTextPopup({
  streamId,
  currentUserId,
  currentUsername,
  canSend,
}: UseBroadcastTextPopupOptions): UseBroadcastTextPopupReturn {
  const [activePopup, setActivePopup] = useState<BroadcastTextPopupPayload | null>(null);
  const [sending, setSending] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any existing hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Schedule popup hide
  const scheduleHide = useCallback(
    (durationMs: number) => {
      clearHideTimeout();
      hideTimeoutRef.current = setTimeout(() => {
        setActivePopup(null);
        hideTimeoutRef.current = null;
      }, durationMs);
    },
    [clearHideTimeout],
  );

  // Subscribe to broadcast text popup channel
  useEffect(() => {
    if (!streamId) return;

    // Clean up previous channel if streamId changed
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`broadcast-text-popup:${streamId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'broadcast',
        { event: 'broadcast_text_popup' },
        ({ payload }: { payload: BroadcastTextPopupPayload }) => {
          setActivePopup(payload);
          scheduleHide(payload.duration_ms);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      clearHideTimeout();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [streamId, clearHideTimeout, scheduleHide]);

  // Send popup
  const sendPopup = useCallback(
    async (message: string, style: PopupStyle, durationMs: number) => {
      if (!canSend || !currentUserId || !streamId) return;
      if (sending) return;

      setSending(true);

      try {
        const payload: BroadcastTextPopupPayload = {
          id: generateUUID(),
          stream_id: streamId,
          sender_id: currentUserId,
          sender_username: currentUsername,
          message: message.trim(),
          style,
          duration_ms: durationMs,
          created_at: new Date().toISOString(),
        };

        // Get the channel and send
        const channel = channelRef.current;
        if (channel) {
          await channel.send({
            type: 'broadcast',
            event: 'broadcast_text_popup',
            payload,
          });
        }
      } catch (err) {
        console.error('[useBroadcastTextPopup] send error:', err);
      } finally {
        setSending(false);
      }
    },
    [canSend, currentUserId, currentUsername, streamId, sending],
  );

  return {
    activePopup,
    sendPopup,
    sending,
  };
}
