# LiveKit Broadcast Grid Seat Rendering & End Stream Fixes

## Summary

This document outlines the comprehensive fixes implemented to resolve seat claiming and rendering issues in the LiveKit broadcast grid, as well as improving the end stream functionality to ensure all users are properly redirected.

## Issues Fixed

### 1. Seat Rendering Logic Issues
- **Problem**: UI showed "Click to Join" even after successfully claiming a seat and publishing tracks
- **Root Cause**: Component only checked for `participant && seat && participant.videoTrack?.track` but didn't account for local participants or optimistic updates
- **Solution**: Enhanced rendering logic to show video for current user's seats even without tracks initially

### 2. Seat Claiming Handler Issues
- **Problem**: No optimistic updates - users had to wait for Supabase realtime to show seat as claimed
- **Solution**: Implemented optimistic seat claiming with visual feedback

### 3. End Stream Handler Issues
- **Problem**: Only disconnected locally and updated database, didn't broadcast events or force navigation
- **Solution**: Enhanced to broadcast events and force navigation for all clients

### 4. Missing Realtime Listeners
- **Problem**: No mechanism to detect stream end events and redirect users
- **Solution**: Created comprehensive realtime listener hook

## Code Changes

### 1. OfficerStreamGrid Component (`src/components/OfficerStreamGrid.tsx`)

#### Key Changes:
- Added `streamId` prop for end stream detection
- Implemented optimistic seat claiming with `claimedSeats` state
- Enhanced participant mapping to use `localParticipant` for current user
- Added realtime listener for stream end events
- Improved rendering logic to show video for current user's seats
- Added visual feedback for claiming state ("Joining...")

#### New Features:
```typescript
// Optimistic seat claiming
const [claimedSeats, setClaimedSeats] = useState<Set<number>>(new Set())

// Enhanced participant mapping
let participant = participantsList?.find((p) => {
  if (!seat?.user_id) return false
  if (p.identity === seat.user_id) return true
  const metadataUserId = parseLiveKitMetadataUserId(p.metadata)
  return metadataUserId === seat.user_id
})

// Use localParticipant for current user's seat
if (!participant && isCurrentUserSeat && localParticipant) {
  participant = localParticipant as any
}

// Realtime listener for stream end
useEffect(() => {
  if (!streamId) return
  
  const channel = supabase
    .channel(`stream-${streamId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${streamId}`,
      },
      (payload) => {
        const newRecord = payload.new as any
        if (newRecord?.status === 'ended' || newRecord?.is_live === false) {
          console.log('[OfficerStreamGrid] Stream ended detected, redirecting to summary...')
          window.location.href = `/stream-summary/${streamId}`
        }
      }
    )
    .subscribe()
}, [streamId])
```

### 2. Enhanced End Stream Handler (`src/lib/endStream.ts`)

#### Key Changes:
- Enhanced to broadcast stream-ended events to all clients
- Added Supabase realtime broadcast mechanism
- Force navigation for local client if on stream page
- Improved error handling and logging

#### New Features:
```typescript
// Broadcast stream ended event to all clients
try {
  const channel = supabase.channel(`stream-${streamId}`)
  
  // Send realtime event to notify all connected clients
  await channel.send({
    type: 'broadcast',
    event: 'stream-ended',
    payload: {
      streamId,
      endedAt: new Date().toISOString(),
      reason: 'ended_by_host'
    }
  })
  
  console.log('[endStream] Broadcast stream-ended event to all clients')
} catch (broadcastError) {
  console.warn('Error broadcasting stream-ended event:', broadcastError)
}

// Force navigation if we're still on the stream page
if (typeof window !== 'undefined') {
  const currentPath = window.location.pathname
  if (currentPath.includes(`/stream/${streamId}`) || currentPath.includes('/broadcast')) {
    console.log('[endStream] Forcing navigation to stream summary...')
    setTimeout(() => {
      window.location.href = `/stream-summary/${streamId}`
    }, 500)
  }
}
```

### 3. Stream End Listener Hook (`src/hooks/useStreamEndListener.ts`)

#### New Hook:
```typescript
export function useStreamEndListener({
  streamId,
  enabled = true,
  redirectToSummary = true,
}: UseStreamEndListenerProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled || !streamId) return

    console.log('[useStreamEndListener] Setting up listener for stream:', streamId)

    // Main listener for stream table updates
    const streamChannel = supabase
      .channel(`stream-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newRecord = payload.new as any
          console.log('[useStreamEndListener] Stream update detected:', newRecord)
          
          if (newRecord?.status === 'ended' || newRecord?.is_live === false) {
            console.log('[useStreamEndListener] Stream ended detected, redirecting to summary...')
            if (redirectToSummary) {
              navigate(`/stream-summary/${streamId}`)
            }
          }
        }
      )
      .on(
        'broadcast',
        { event: 'stream-ended' },
        (payload) => {
          console.log('[useStreamEndListener] Received broadcast stream-ended event:', payload)
          const { streamId: endedStreamId } = payload.payload || {}
          
          if (endedStreamId === streamId) {
            console.log('[useStreamEndListener] Stream ended via broadcast, redirecting...')
            if (redirectToSummary) {
              navigate(`/stream-summary/${streamId}`)
            }
          }
        }
      )
      .subscribe()

    return () => {
      console.log('[useStreamEndListener] Cleaning up listeners for stream:', streamId)
      streamChannel.unsubscribe()
    }
  }, [streamId, enabled, redirectToSummary, navigate])
}
```

### 4. BroadcastPage Updates (`src/pages/BroadcastPage.tsx`)

#### Key Changes:
- Import and use `useStreamEndListener` hook
- Pass `streamId` prop to `OfficerStreamGrid`
- Update `handleEndStream` to navigate to correct summary route

#### Implementation:
```typescript
// Import the new hook
import { useStreamEndListener } from '../hooks/useStreamEndListener'

// Add the listener in useEffect
useStreamEndListener({
  streamId: streamId || '',
  enabled: !!streamId,
  redirectToSummary: true,
})

// Pass streamId to OfficerStreamGrid
<OfficerStreamGrid
  roomName={roomName}
  streamId={streamId}
  onSeatClick={(idx) => {
    setTargetSeatIndex(idx);
    handleSeatClaim(idx).catch(() => {});
  }}
/>

// Update handleEndStream to navigate correctly
const handleEndStream = useCallback(async () => {
  // ... existing code ...
  
  // Navigate to stream summary page with stream ID
  navigate(`/stream-summary/${stream.id}`)
}, [stream?.id, currentSeatIndex, leaveSeat, navigate, liveKit])
```

## How It Works

### Seat Claiming Flow:
1. User clicks "Click to Join" on an empty seat
2. UI optimistically shows "Joining..." state immediately
3. Camera/microphone permissions requested
4. Seat claimed in Supabase via `claimSeat()`
5. LiveKit connection established and tracks published
6. UI updates to show user's video stream
7. If any step fails, optimistic state is cleared

### End Stream Flow:
1. Host/admin clicks "End Stream"
2. `endStream()` function called with stream ID and LiveKit room
3. LiveKit tracks cleaned up and room disconnected
4. Stream record updated in Supabase (`status: 'ended'`)
5. Broadcast event sent via Supabase realtime
6. Local navigation forced if on stream page
7. All connected clients receive realtime update and redirect to summary

### Realtime Detection:
1. All stream components listen for:
   - Direct database updates (stream table status changes)
   - Broadcast events (stream-ended events)
2. When detected, automatic navigation to `/stream-summary/:streamId`
3. Cleanup of LiveKit connections and track resources

## Benefits

### For Users:
- **Immediate visual feedback** when claiming seats
- **Reliable seat rendering** with proper local participant display
- **Automatic redirection** when streams end
- **No stuck states** - everyone gets redirected properly

### For Developers:
- **Optimistic UI updates** for better user experience
- **Comprehensive error handling** with cleanup on failures
- **Reusable hooks** for stream end detection
- **Proper resource cleanup** for LiveKit connections

## Testing Recommendations

1. **Seat Claiming Test**:
   - Click empty seat → should show "Joining..." immediately
   - Grant permissions → should show user video in seat
   - Test failure scenarios → should clear optimistic state

2. **End Stream Test**:
   - Start stream with multiple participants
   - Host clicks "End Stream"
   - Verify all users redirect to summary page
   - Check database shows `status: 'ended'`

3. **Realtime Test**:
   - Open stream in multiple tabs/browsers
   - End stream from one client
   - Verify all clients redirect automatically

## Files Modified

1. `src/components/OfficerStreamGrid.tsx` - Enhanced seat rendering and claiming
2. `src/lib/endStream.ts` - Improved end stream with broadcasting
3. `src/hooks/useStreamEndListener.ts` - New hook for stream end detection
4. `src/pages/BroadcastPage.tsx` - Integration with new features

## Backwards Compatibility

All changes are backwards compatible:
- `streamId` prop is optional in `OfficerStreamGrid`
- Existing functionality preserved when `streamId` not provided
- New features only activate when proper context available

This implementation ensures a robust, user-friendly broadcast grid experience with proper seat management and end stream handling.