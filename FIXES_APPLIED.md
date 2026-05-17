Summary of all fixes applied to the vote system:

## Fixed Issues

### 1. `src/hooks/useBroadcastRealtime.ts` (line 303-328)
**Bug:** The `like_sent` realtime handler always incremented `totalLikes` by 1, ignoring the actual `total_likes` value returned by the server.
**Fix:** Now uses `likeData.total_likes` from the server response as the source of truth. Falls back to +1 only if unavailable.

### 2. `src/pages/Troting.tsx` - handleVote (line 135-173)
**Bug:** After a successful `vote_for_pitch` RPC, the returned `vote_count`, `up_votes`, `down_votes` were ignored — UI never updated.
**Fix:** Local state now updates with server-returned vote counts immediately after a successful vote.

### 3. `src/pages/Troting.tsx` - realtime subscription (line 96-130)
**Bug:** The pitch update listener only synced `vote_count`, not `up_votes`/`down_votes`.
**Fix:** Now syncs all three fields (`vote_count`, `up_votes`, `down_votes`) from postgres changes.

### 4. `src/components/broadcast/BattleSwipeCard.tsx` (line 226-233)
**Bug:** Referenced `result.new_like_count` which doesn't exist in the server response (returns `total_likes`).
**Fix:** Changed to use `result.total_likes` with fallback to `likeCount + 1`.

### 5. `supabase/migrations/20270218100000_president_system.sql` - vote_for_president_candidate
**Bug:** Raw INSERT without duplicate handling caused PostgreSQL "duplicate key value violates unique constraint" error. Also didn't increment `vote_count` on the candidate.
**Fix:** Added pre-check for existing votes (returns JSON `{ already_voted: true }`), increments `vote_count`, returns JSON response instead of `void`.

### 6. `supabase/migrations/20270301000000_president_v2.sql` - vote_candidate_with_coins
**Bug:** Same raw INSERT duplicate key issue and missing `vote_count` increment.
**Fix:** Added duplicate vote check, returns JSON, increments both `score` and `vote_count`.

### 7. NEW: `supabase/migrations/20270405000001_add_vote_count_to_candidates.sql`
**Bug:** `president_candidates` table had no `vote_count` column.
**Fix:** Migration adds the missing `vote_count` column with default 0.

### 8. `src/hooks/usePresidentSystem.ts` - voteForCandidate & voteWithCoins
**Bug:** Didn't handle `already_voted` JSON response; raw PostgreSQL constraint errors shown to users.
**Fix:** Checks `data.already_voted` and shows "You already voted this week". Catches duplicate errors as fallback.

### 9. `src/pages/broadcast/BroadcastPage.tsx` (line 572)
**Bug:** `useBroadcastTicker()` called without required arguments, causing `Cannot destructure property 'streamId' of 'undefined'`.
**Fix:** Passes `{ streamId, userId, isHost }` from component scope.

## Root Causes
- `send-like` edge function returns `{ total_likes, user_like_count, coins_awarded }` but components referenced non-existent `new_like_count`
- Real-time handlers did simple +1 increments instead of trusting the server's authoritative count
- `vote_for_president_candidate` let PostgreSQL throw a constraint violation instead of returning a friendly JSON error
- `vote_candidate_with_coins` had the same duplicate INSERT issue
- `president_candidates` table was missing `vote_count` column
- `useBroadcastTicker` hook required arguments that weren't being passed