import { supabase } from '../lib/supabase'

export interface ViewerAdmissionResult {
  allowed: boolean
  reason: string | null
  viewer_count: number
  viewer_cap: number
}

export interface StartBroadcastResult {
  allowed: boolean
  reason: string | null
  active_broadcasts: number
  start_cap: number
}

/**
 * Authoritative viewer-cap admission. The entire check (validate stream ->
 * read cap config -> count active viewers under a row lock -> reject-or-insert)
 * happens in the join_stream_as_viewer RPC. The client must call this BEFORE
 * connecting to LiveKit. Frontend state is never trusted for capacity.
 *
 * p_user_id: the caller's auth.uid() (null for fully-unauthenticated guests).
 * p_guest_id: a stable per-session guest identity for guests without an
 *             auth.uid(). One slot per (stream, user) or (stream, guest).
 */
export async function admitViewerToStream(
  streamId: string,
  p_user_id: string | null,
  p_guest_id: string | null,
): Promise<ViewerAdmissionResult> {
  const { data, error } = await supabase.rpc('join_stream_as_viewer', {
    p_stream_id: streamId,
    p_user_id: p_user_id ?? null,
    p_guest_id: p_guest_id ?? null,
  })

  if (error) {
    // Network/permission error -> fail closed but do not connect.
    console.warn('[admitViewerToStream] RPC error', error)
    return { allowed: false, reason: 'admission_error', viewer_count: 0, viewer_cap: 0 }
  }

  const result = (data ?? {}) as ViewerAdmissionResult
  return {
    allowed: Boolean(result.allowed),
    reason: result.reason ?? null,
    viewer_count: Number(result.viewer_count ?? 0),
    viewer_cap: Number(result.viewer_cap ?? 0),
  }
}

/** Release a reserved capacity slot (on LiveKit failure or explicit leave). */
export async function releaseViewerSlot(
  streamId: string,
  p_user_id: string | null,
  p_guest_id: string | null,
): Promise<void> {
  try {
    await supabase.rpc('leave_stream_as_viewer', {
      p_stream_id: streamId,
      p_user_id: p_user_id ?? null,
      p_guest_id: p_guest_id ?? null,
    })
  } catch (err) {
    console.warn('[releaseViewerSlot] failed', err)
  }
}

/**
 * Authoritative start-capacity check. Counts currently active broadcasts and
 * atomically transitions the owner's stream to live when allowed. Reconnects to
 * an already-live owned stream are permitted.
 */
export async function startBroadcastWithCapacityCheck(
  streamId: string,
): Promise<StartBroadcastResult> {
  const { data, error } = await supabase.rpc('start_broadcast_with_capacity_check', {
    p_stream_id: streamId,
  })

  if (error) {
    console.warn('[startBroadcastWithCapacityCheck] RPC error', error)
    return { allowed: false, reason: 'start_error', active_broadcasts: 0, start_cap: 0 }
  }

  const result = (data ?? {}) as StartBroadcastResult
  return {
    allowed: Boolean(result.allowed),
    reason: result.reason ?? null,
    active_broadcasts: Number(result.active_broadcasts ?? 0),
    start_cap: Number(result.start_cap ?? 0),
  }
}
