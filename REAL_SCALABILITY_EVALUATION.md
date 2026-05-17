# Real System Scalability Evaluation

Based on a deep code analysis of the current production codebase (`useLiveKitSession.ts`, `LiveKitService.ts`, and database schemas), here is the realistic evaluation of your system's limits.

## 1. Concurrent Users (The "Hard" Limit)
**Current Limit:** ~500 - 1,000 Concurrent Active Users
**The Bottleneck:** PostgreSQL Database Connections

*   **Why:** Your application runs on Supabase (PostgreSQL). The Standard/Pro tier typically has a limit of ~500 concurrent direct connections.
*   **The Crash Point:** If 600 users try to load the "Home" feed or "Leaderboard" at the exact same second, the database will reject connections (`FATAL: remaining connection slots are reserved for non-replication superuser roles`).
*   **Mitigation in Code:** You are using `SupabaseClient` which is good, but heavy features like "Live Global Chat" or "Realtime Leaderboards" consume these connections rapidly.
*   **Solution:** Enable **PgBouncer** (Transaction Pooling) in Supabase settings immediately. This raises the effective limit to ~10,000+ users.

## 2. Broadcast Capacity (The "Stage" Limit)
**Max Speakers:** 6 per Room
**Max Viewers:** Theoretically Unlimited (Wallet Dependent)

*   **Speakers/Guests:**
    *   **Code Constraint:** `useLiveKitSession.ts` explicitly defines:
        ```typescript
        const maxParticipants = options.maxParticipants ?? 6;
        if (participants.size > maxParticipants) throw new Error("Room is full");
        ```
    *   **Implication:** Only 6 people can ever be "on stage" (Video/Audio) at once. The 7th person trying to join with audio/video will be rejected by the client.
    *   **Crash Point:** This is a soft limit to protect client performance. Removing it allows more, but >12 video feeds will lag most mobile devices.

*   **Viewers:**
    *   Viewers connect as "subscribe-only". LiveKit handles this well.
    *   **Cost Reality:** 1,000 viewers watching 1 hour of video = ~300GB of bandwidth. This gets expensive fast ($0.10/GB typical).

## 3. Gifting & Transactions (The "Speed" Limit)
**Throughput:** ~50 - 100 Gifts per Second (Global)

*   **Why:** Every gift triggers a database transaction:
    1.  Deduct coins from Sender.
    2.  Add coins to Receiver.
    3.  Insert record into `ledger`.
    4.  Update `streams` stats.
*   **The Crash Point:** If a popular streamer gets "gift bombed" by 500 users instantly, the database row for that streamer's profile will lock.
*   **Result:** Transactions will queue up. Users will see "Spinning" loaders. Eventually, some will fail with "Transaction timeout".
*   **Fix:** The current `RPC` approach is correct (`vote_candidate_with_coins` uses `UPDATE ... set score = score + x`), but heavy loads require **Batching** (grouping 100 updates into 1 DB call) or a Redis buffer.

## 4. "Thanos Snap" Scenarios (What breaks first?)

| Scenario | Outcome | Reason |
| :--- | :--- | :--- |
| **5,000 users open the app at once** | **CRASH** | Database connection limit hit immediately. |
| **1 Streamer, 6 Guests** | **STABLE** | Code handles this perfectly. |
| **1 Streamer, 20 Guests** | **BLOCK** | Client code rejects the 7th+ guest. |
| **1,000 users send a gift at same second** | **LAG/FAIL** | Row locking on the receiver's profile. |
| **100 Broadcasters live at once** | **STABLE** | LiveKit scales rooms horizontally easily. |

## 5. Summary Recommendations

1.  **Immediate:** Enable **PgBouncer** in your Supabase Dashboard. This is a one-click fix for the User Limit.
2.  **Code Change:** If you need more than 6 guests (e.g., for a "Jury" or "Council"), update `useLiveKitSession.ts` to increase `maxParticipants`.
3.  **Future:** If you expect massive "Gift Bombs", implement a "Pending Balance" system where gifts are aggregated in memory/Redis and flushed to the DB every 5 seconds.
