# Seat Queue System Implementation Guide

**Status**: Partial implementation completed. Ready for final integration and testing.

## Completed Components ✅

### 1. Database & RPC Layer
- **File**: `supabase/migrations/20260516000000_stream_seat_requests_queue.sql`
- **Contents**:
  - `stream_seat_requests` table with full schema
  - RPC 1: `request_stream_seat()` - viewer requests seat with payment
  - RPC 2: `approve_stream_seat_request()` - broadcaster approves
  - RPC 3: `deny_stream_seat_request()` - broadcaster denies + refunds
  - RPC 4: `mark_seat_request_joined()` - confirm successful join
  - RPC 5: `refund_failed_seat_request()` - cleanup & refunds
  - Helper: `expire_old_seat_requests()` - periodic cleanup

### 2. TypeScript Types
- **File**: `src/types/seatRequest.ts`
- **Includes**: Request types, UI states, LiveKit token interfaces

### 3. Hooks
- **File**: `src/hooks/useSeatRequests.ts`
  - Fetch user's seat requests for a stream
  - Realtime subscription to request status changes
  - Methods: requestSeat(), cancelRequest()

- **File**: `src/hooks/useSeatLiveKit.ts`
  - Separate hook for seat-only LiveKit logic
  - Watches approved request status
  - Requests media permission → connects to LiveKit → publishes tracks
  - Marks joined only after successful publish
  - Handles refunds on failure
  - Does NOT touch broadcaster logic

### 4. Components
- **File**: `src/components/broadcast/SeatRequestQueue.tsx`
  - Broadcaster sees list of pending requests
  - Accept/Deny buttons with reason input
  - Shows countdown timer for expiration
  - Integrates with approve/deny RPC functions

- **File**: `src/components/broadcast/SeatRequestModal.tsx`
  - Shown to viewer after clicking seat
  - States: waiting_approval → approved → connecting → error/denied
  - Explains camera/mic will turn on
  - Handles permission flow

## Remaining Implementation Tasks

### Task 1: Update SeatBox Rendering (if exists)
Look for seat box rendering in `BroadcastGrid.tsx` (~line 1354+)
- **Remove**: Plus/Minus buttons for broadcaster manual seat control
- **Hide**: onAddBox/onRemoveBox callbacks in host mode
- These controls become hidden since seats are now request-based

### Task 2: Create Broadcaster Queue Hook
**File**: `src/hooks/useBroadcasterSeatQueue.ts`
```typescript
export function useBroadcasterSeatQueue(streamId: string, broadcasterProfile: any) {
  // Fetch pending requests for this stream/broadcaster
  const { requests, loading, error, refetch } = useStreamRequests();
  
  // Subscribe to realtime changes
  // useEffect with supabase realtime on stream_seat_requests
  
  // Approve seat request
  const approveSeat = async (requestId: string) => {
    const { data, error } = await supabase.rpc('approve_stream_seat_request', {
      p_request_id: requestId,
    });
    // Creates the reserved seat session
    return { success: !error, sessionId: data?.session_id };
  };
  
  // Deny seat request
  const denySeat = async (requestId: string, reason?: string) => {
    const { error } = await supabase.rpc('deny_stream_seat_request', {
      p_request_id: requestId,
      p_deny_reason: reason,
    });
    // Refunds viewer automatically
    return { success: !error };
  };
  
  return { requests, approveSeat, denySeat, loading, error };
}
```

### Task 3: Integrate Queue into BroadcastPage
**File**: `src/pages/broadcast/BroadcastPage.tsx`
- Add useBroadcasterSeatQueue() hook
- Render SeatRequestQueue component in broadcast UI
- Show badge with pending request count
- Do NOT modify SetupPage or core broadcaster LiveKit logic

### Task 4: Integrate Request Flow into Viewer/Seat Click
**File**: Need to find where viewers click seats
- Add useSeatRequests hook
- Show SeatRequestModal when status changes
- Integrate useSeatLiveKit for approved state
- Call requestSeat RPC on seat click

### Task 5: Update SeatSession Status
**File**: Check `stream_seat_sessions` in database
- Add 'reserved' status for approved but not yet joined
- Update migrations if needed
- Update RLS policies if needed

### Task 6: Edge Function for Seat LiveKit Tokens
**File**: `supabase/functions/livekit-token/index.ts` (modify or create)
- Check if participantType === 'seat'
- If seat token:
  - Use participantName = `seat-${userId}-${requestId}`
  - Keep same room as broadcaster
  - Return URL + token + roomName
- Do NOT modify broadcaster token logic

### Task 7: Timeout System
Implement two timeout managers:

**Pending Approval Timeout** (2 minutes):
```typescript
useEffect(() => {
  if (currentRequest?.status === 'pending' && currentRequest?.expires_at) {
    const timeout = new Date(currentRequest.expires_at).getTime() - Date.now();
    const timer = setTimeout(() => {
      // Call expire_old_seat_requests() via RPC
      // Refunds will happen automatically
    }, timeout);
    return () => clearTimeout(timer);
  }
}, [currentRequest]);
```

**Approved But Not Joined Timeout** (60 seconds):
```typescript
useEffect(() => {
  if (seatRequest?.status === 'approved' && !hasPublishedTracks) {
    const timer = setTimeout(() => {
      refundFailedSeat('timeout_not_joined');
    }, 60000);
    return () => clearTimeout(timer);
  }
}, [seatRequest, hasPublishedTracks]);
```

### Task 8: Refund Handling
Refunds should happen automatically via RPC in these scenarios:
1. Broadcaster denies → deny_stream_seat_request RPC
2. Viewer cancels pending → update status to cancelled
3. Request expires → expire_old_seat_requests RPC
4. Viewer fails to join → useSeatLiveKit refundFailedSeat()
5. LiveKit connection fails → useSeatLiveKit error handler

### Task 9: Seat Rendering States
Update SeatBox rendering to reflect:
```
empty → no request or session
pending_request → request.status = 'pending'
approved_waiting → request.status = 'approved' && !joined
connecting → useSeatLiveKit.state = 'connecting'
live → request.status = 'joined' && hasPublishedTracks
failed → request.status = 'refunded' or error
```

Only show as "live" when LiveKit participant is actually connected with tracks published.

### Task 10: Realtime Subscriptions
Update seat components to subscribe to:
```typescript
// Broadcaster subscribes to pending requests
supabase
  .from('stream_seat_requests')
  .on('*', (payload) => {
    if (payload.new.stream_id === streamId && 
        payload.new.status === 'pending') {
      // Update queue display
    }
  })
  .subscribe();

// Viewer subscribes to their own request status
supabase
  .from('stream_seat_requests')
  .on('*', (payload) => {
    if (payload.new.id === currentRequest?.id) {
      // Update modal display
    }
  })
  .subscribe();

// Seat grid subscribes to session changes
supabase
  .from('stream_seat_sessions')
  .on('*', (payload) => {
    if (payload.new.stream_id === streamId) {
      // Update seat visuals
    }
  })
  .subscribe();
```

## Critical Integration Points

### BroadcastPage.tsx Changes Needed
```typescript
// Add broadcaster queue hook
const { requests, approveSeat, denySeat } = useBroadcasterSeatQueue(stream.id, broadcasterProfile);

// Render queue component (likely in a panel or modal)
<SeatRequestQueue
  requests={requests}
  onApprove={approveSeat}
  onDeny={denySeat}
/>
```

### Viewer Seat Click Flow
When viewer clicks a seat:
```typescript
const handleSeatClick = async (seatIndex: number) => {
  // 1. Request seat via RPC
  const { success, requestId } = await requestSeat(seatIndex, seatPrice);
  
  // 2. Show approval modal
  setShowModal(true);
  
  // 3. Wait for approval (via realtime subscription)
  // useSeatRequests hook updates currentRequest
  
  // 4. When approved, useSeatLiveKit takes over
  // It requests permission and publishes tracks
  
  // 5. When joined, seat becomes live
};
```

## Files NOT to Touch
- `src/pages/broadcast/BroadcastPage.tsx` (only add queue component)
- `src/pages/broadcast/SetupPage.tsx` (no changes)
- `src/lib/preflightStore.ts` (broadcaster-only)
- Broadcaster LiveKit connection logic

## Testing Checklist
- [ ] Viewer clicks seat → payment deducted
- [ ] Broadcaster sees pending request in queue
- [ ] Broadcaster approves → viewer sees approval modal
- [ ] Viewer grants camera/mic → tracks publish → seat goes live
- [ ] Viewer denies permission → refund processed
- [ ] Broadcaster denies → refund processed
- [ ] Request expires (2 min) → refund processed
- [ ] Approved but not joined (60 sec) → refund processed
- [ ] Multiple viewers can request same stream
- [ ] Only one request per user per stream at a time
- [ ] Broadcaster cannot request their own seat
- [ ] Seat grid shows correct states (empty/pending/approved/live/failed)
- [ ] LiveKit broadcasts and seat users in same room
- [ ] Broadcaster tracks separate from seat user tracks

## Coin Flow Verification
```
Viewer clicks seat → [deduct coins] → create pending request
Broadcaster approves → create reserved seat session
Viewer joins → [no change, already paid]
Viewer denied or fails → [refund coins] (automatic via RPC)
```

Broadcaster balance:
```
Viewer pays → [broadcaster gains coins]
Refund issued → [broadcaster loses coins]
Broadcaster balance can go negative
```

## Important Notes
1. Do NOT create a hard dependency on SeatSession existing before approval
2. Use RPC transactions to keep payments atomic
3. Refund logic must not fail - always complete even if balance goes negative
4. Session_id from approve_stream_seat_request must be passed to LiveKit hook
5. Only mark request as "joined" after successful track publish
6. Timeout expiry should trigger refunds automatically
7. Separate media permission request from LiveKit connection
8. Show countdown timer in queue for broadcaster visibility
9. Show clear status messages to viewer throughout flow
10. Use toast notifications for all major events

## Performance Considerations
- Use indexes on stream_seat_requests queries
- Subscribe to specific streams, not all requests
- Limit realtime payload sizes
- Clean up subscriptions on component unmount
- Debounce timer updates in queue display
- Virtualize long queue lists if needed

## Security Notes
- RLS policies ensure users can only see their own requests
- Broadcaster can only approve/deny their own stream requests
- RPC functions use SECURITY DEFINER for transactional safety
- Payment deduction and refund happen atomically in RPC
- No manual balance checks in refund (can go negative)
