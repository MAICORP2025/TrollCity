# Broadcast-Wide Entrance Effects Test Plan

## Overview
This document outlines the test plan for verifying the broadcast-wide entrance effects feature, where all users in a broadcast see/hear entrance effects when anyone joins.

## Test Prerequisites
- Two or more browser windows/devices
- User accounts with different entrance effects configured
- A live broadcast stream
- Developer console access for logging verification

## Test Cases

### TC1: Basic Entrance Effect Broadcast
**Objective**: Verify entrance effects play for all users when someone joins

**Steps**:
1. Open Browser A and navigate to a live broadcast
2. Note your entrance effect configuration
3. Open Browser B (incognito or different user) and navigate to the same broadcast
4. Observe Browser A - should see/hear Browser B's entrance effect
5. Observe Browser B - should see/hear its own entrance effect

**Expected Results**:
- ✅ Browser A sees Browser B's entrance animation
- ✅ Browser A hears Browser B's entrance sound
- ✅ Browser B sees its own entrance animation
- ✅ Console shows `[useListenForEntrances] Processing entrance event`

**Verification Commands**:
```javascript
// Check console for these logs:
// [usePublishEntranceOnJoin] Published entrance event: ...
// [useListenForEntrances] Processing entrance event: ...
// [EntranceAnimation] Playing entrance animation: ...
```

### TC2: Deduplication - No Duplicate Entrances
**Objective**: Verify entrance effects don't replay for the same event

**Steps**:
1. User A joins broadcast (entrance plays)
2. Refresh User A's browser page
3. User A should NOT see another entrance effect

**Expected Results**:
- ✅ First join: Entrance effect plays
- ✅ After refresh: No duplicate entrance effect
- ✅ Console shows deduplication log: `[useListenForEntrances] Duplicate event detected`

### TC3: No Entrance Effects on Home Page
**Objective**: Verify entrance effects never trigger outside broadcast context

**Steps**:
1. Navigate away from broadcast to Home or other pages
2. Ensure no entrance animations/sounds trigger

**Expected Results**:
- ✅ No entrance effects trigger on Home page
- ✅ Console shows: `[useListenForEntrances] Not in broadcast context, skipping initialization`

### TC4: Reconnect Handling
**Objective**: Verify entrance effects work with LiveKit reconnects

**Steps**:
1. User is connected to broadcast
2. Simulate network disconnection/reconnection
3. After reconnection, entrance effect should not replay excessively

**Expected Results**:
- ✅ Reconnect doesn't trigger duplicate entrance
- ✅ Connection state transitions are logged: `[usePublishEntranceOnJoin] Connection established`

### TC5: Multiple Users Joining
**Objective**: Verify system handles multiple users joining sequentially

**Steps**:
1. User A is in broadcast
2. User B joins
3. User C joins
4. User D joins
5. User A should see all three entrance effects

**Expected Results**:
- ✅ Each user gets one entrance effect
- ✅ Multiple animations can play (with timing differences)
- ✅ All eventIds are unique and tracked

### TC6: Audio Handling
**Objective**: Verify audio plays correctly without 416 errors

**Steps**:
1. User joins broadcast
2. Verify audio plays once
3. Check network tab for audio file requests

**Expected Results**:
- ✅ Audio plays exactly once per entrance
- ✅ No 416 Range errors in network tab
- ✅ Audio cleanup happens properly (URL.revokeObjectURL)

## Debug Console Commands

Enable verbose logging:
```javascript
localStorage.setItem('debug_entrance', 'true');
```

Check processed events:
```javascript
// Access the processed events set
// The Set is maintained in useListenForEntrances hook
```

Reset deduplication (for testing):
```javascript
sessionStorage.removeItem('entrance_events_processed');
```

## Acceptance Criteria Verification

| Criteria | Status | Notes |
|----------|--------|-------|
| Entrance effect plays for all users in broadcast | ✅ | via PublishEntranceOnJoin + ListenForEntrances |
| No entrance effect on Home/other pages | ✅ | isInBroadcastContextRef guard |
| No duplicates (dedupe by eventId) | ✅ | Set-based deduplication |
| No 416 Range errors | ✅ | Existing playSoundEffect handles this |
| Works with reconnects | ✅ | connectionState check prevents duplicates |

## Known Limitations

1. **Mux-only listeners**: This implementation requires LiveKit connection. For Mux-only viewers, the fallback Supabase Realtime implementation would be needed (not implemented in this version).

2. **Audio autoplay**: Browsers require user interaction before audio can play. The `StartAudio` component handles this.

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| No entrance effect visible | Not in broadcast context | Check URL contains /broadcast/, /watch/, or /stream/ |
| Entrance plays twice | Duplicate eventId | Check sessionStorage not corrupted |
| Audio not playing | No user interaction | Click anywhere on page before joining |
| Animation not found | Invalid effectKey | Check user has valid entrance effect configured |

## Performance Considerations

- Deduplication Set is cleared on component unmount
- Event IDs include timestamp + random suffix for uniqueness
- Audio objects are properly revoked to prevent memory leaks
- Animation elements are removed via setTimeout cleanup
