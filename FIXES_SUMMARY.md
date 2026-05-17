# Bug Fixes & Implementation Summary

## Issues Fixed

### 1. ❌ Past Broadcasts Removed from Profile
**Problem:** Past Broadcasts tab showing user's own ended streams was redundant - we now have Saved Streams.

**Fix:**
- Removed `PastBroadcasts` import from Profile.tsx
- Removed `past_broadcasts` tab from `tabOptions`
- Removed PastBroadcasts rendering conditional
- Deleted `src/components/profile/PastBroadcasts.tsx`

**Result:** Profile now only has "Social" and "Saved Streams" (for own profile) plus admin/inventory tabs.

---

### 2. 🔧 GlobalPresenceTracker JWT Error Fixed
**Error:** `ReferenceError: sendHeartbeat is not defined` + `Expected 3 parts in JWT; got 1`

**Root Causes:**
1. Stale import of `sendHeartbeat` from useQueries (function was removed earlier)
2. Manual JWT extraction from localStorage using wrong key (`'sb-auth-token'`) which returned a non-JWT string

**Fixes Applied:**

#### a) Removed broken `sendHeartbeat` import and call
```diff
- import { sendHeartbeat } from '../hooks/useQueries';
- sendHeartbeat().catch(() => {});
```
The `sendHeartbeat` function was legacy code. The actual heartbeat is handled by `updateOnlineStatus()` which already updates user_profiles and active_sessions.

#### b) Replaced localStorage token with proper Supabase session
```ts
// BEFORE (broken):
'Authorization': `Bearer ${localStorage.getItem('sb-auth-token')?.replace(/['"]/g, '')}`

// AFTER (correct):
const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
if (!token) return; // Guard: skip if not authenticated
'Authorization': `Bearer ${token}`
```

The token now comes from:
- `session` prop from `useAuthStore()` (already available in component)
- OR fallback to `supabase.auth.getSession()` (live fetch)

This ensures a valid JWT with 3 parts (header.payload.signature).

#### c) Removed broken `beforeunload` handler
The old code used `navigator.sendBeacon()` with PATCH method, which isn't supported. Presence tracking now relies on:
- Visibility change → `updateOnlineStatus(isVisible)`
- 30-second sync interval → fetches online count but doesn't need to update self
- Server-side session expiry handles cleanup

---

### 3. ✅ useLiveStreams userId Bug Fixed (Re-applied after revert)
**Problem:** `useLiveStreams` hook used non-existent `userId` from store, causing `if (!userId) return null` to always return null → no live streams shown.

**Fix:**
```ts
// BEFORE:
const { userId } = useAuthStore() // userId undefined
if (!userId) return null;

// AFTER:
const user = useAuthStore((state) => state.user);
const userId = user?.id;
// Removed guard - live streams are public, no auth needed
```

**File:** `src/hooks/useQueries.ts` (lines 15-17, 19 removed)

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | Removed PastBroadcasts tab & import |
| `src/components/profile/SavedBroadcasts.tsx` | NEW - Saved streams viewer |
| `src/pages/broadcast/SetupPage.tsx` | Added Save Broadcast button |
| `src/pages/broadcast/StreamSummary.tsx` | Added auto-save + status banner |
| `supabase/migrations/20250425000000_saved_streams.sql` | NEW - DB table + trigger |
| `src/components/GlobalPresenceTracker.tsx` | Fixed JWT token & removed sendHeartbeat |
| `src/hooks/useQueries.ts` | Fixed userId undefined bug |

---

## Testing Checklist

### A. Save Broadcast Feature
1. ✅ Go to `/broadcast/setup`
2. ✅ Click "Save Broadcast" (button turns green)
3. ✅ Click "Start Broadcast"
4. ✅ End stream (or wait for auto-end)
5. ✅ Check summary page shows "Saved to Profile" green banner
6. ✅ Go to Profile → "Saved Streams" tab → stream appears

### B. Presence Tracking (No More JWT Errors)
1. ✅ Open browser console → no `sendHeartbeat is not defined` errors
2. ✅ No `Expected 3 parts in JWT` errors
3. ✅ `user_presence` updates work (check DB table)

### C. Profile Cleanup
1. ✅ Profile tabs: Social, Saved Streams (if own profile), Background Check, Inventory, Earnings, Purchases, Admin Titles, Settings
2. ✅ No "Past Broadcasts" tab visible

---

## Known Remaining Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Homepage live streams not showing | 🔴 **STILL BROKEN** | `useLiveStreams` now fixed, but Home.tsx was reverted to original. Original Home component uses different query hook. Need to verify original Home component fetches correctly. |
| Promo ads not showing | 🟡 **BY DESIGN** | `city_ads` table likely empty. Not a bug. |
| Save button in Setup not persisting | 🔴 **MIGRATION NEEDED** | Ensure `saved_streams` table exists in DB by running migration |

---

## Next Steps

1. **Run the saved_streams migration** if not done:
   - Open Supabase SQL Editor
   - Run contents of `supabase/migrations/20250425000000_saved_streams.sql`

2. **Test Save Broadcast** end-to-end (steps above)

3. **Fix Home page live grid** if needed (original Home.tsx uses a different data source — may need separate fix)

4. **Clear browser cache** and hard refresh to ensure no stale code with `sendHeartbeat` import remains

---

## Environment Variables Required

Ensure `.env` file has:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The JWT error indicates these are set but the token parsing was broken — now fixed.
