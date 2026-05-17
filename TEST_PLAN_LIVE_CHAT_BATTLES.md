# Test Plan: Live Chat, Battles, and Paid Chat Restrictions

## Overview
Test live chat functionality including normal chatting, paid chat restrictions, and officer moderation capabilities.

## Prerequisites
- Two browser windows (or incognito) logged in as different users
- One as broadcaster (host), one as viewer
- For officer tests: user with `troll_officer` or `lead_troll_officer` role

---

## Test Case 1: Normal Live Chat (Non-Paid)

### Steps:
1. **Broadcaster** starts a stream (any category except those requiring paid chat)
2. **Viewer** joins the stream
3. Viewer sends a chat message
4. Broadcaster sees message appear in chat

### Expected:
- Message appears instantly for both parties
- No coin deduction for standard chat
- Message persists in chat history

---

## Test Case 2: Paid Chat Enabled (Per-User Mode)

### Steps:
1. **Broadcaster** (must be `isAdmin` or `troll_officer`) opens stream settings (gear icon → "Paid Chat")
2. Enable **Paid Chat** toggle
3. Set **Charge Type** to `Per User`
4. Set **Price** to `50` coins
5. Save settings
6. **Viewer** (new or existing) attempts to send a chat message

### Expected:
- Viewer is prompted to pay 50 coins to access chat
- After payment, viewer can send unlimited messages
- Broadcaster receives message normally
- Viewer's coin balance decreases by 50

---

## Test Case 3: Paid Chat Enabled (Per-Message Mode)

### Steps:
1. Broadcaster enables **Paid Chat**, sets **Type** to `Per Chat`
2. Sets **Price** to `10` coins per message
3. Saves
4. Viewer sends first message → pays 10 coins
5. Viewer sends second message → pays another 10 coins

### Expected:
- Each message deducts 10 coins from viewer
- Viewer can continue sending until they run out of coins
- Broadcaster sees all messages

---

## Test Case 4: Troll Officer / Lead Officer Can Bypass (if allowed)

### Steps:
1. Paid Chat is enabled (per-user or per-chat)
2. Log in as a user with role `troll_officer` or `lead_troll_officer`
3. Attempt to send chat

### Expected:
- Officer **CAN** send chat without payment (officers are exempt per code: `canUsePaidChatPerUser = isOfficerOrAdmin || canUsePaidChat`)
- No coin deduction occurs

---

## Test Case 5: User Without Funds Cannot Chat

### Steps:
1. Paid Chat enabled, price = 100 coins
2. Log in as viewer with `troll_coins < 100`
3. Try to send a chat message

### Expected:
- Error toast: "Insufficient troll coins" or similar
- Message NOT sent
- No coins deducted

---

## Test Case 6: Battle Mode + Chat

### Steps:
1. Broadcaster enables Battle mode (category must support battles)
2. Starts a battle (1v1, 2v2, 3v3)
3. Viewers send chat during battle
4. Battle timer counts down in overlay

### Expected:
- Chat continues to work normally during battle
- Battle overlay (score, timer) appears over video
- No interference with chat

---

## Test Case 7: Troll Toe Game + Chat

### Steps:
1. Broadcaster opens Game Picker → selects "Troll Toe"
2. Creates game, starts it, players join sides
3. Viewers (non-players) send chat while game is ongoing
4. Players (in boxes) may also chat (if allowed)

### Expected:
- Chat works normally during game
- Troll Toe UI appears overlayed on video for viewers
- Fog and side selection visible to viewers

---

## Test Case 8: Officer Disables Chat Entirely (Troll Church / Jail)

### Scenario A: Jail (user is jailed)
1. Admin puts a user in jail via `/jail` or admin tools
2. That user attempts to send chat

### Expected:
- Chat message is blocked
- Error toast or silent reject

### Scenario B: Stream-level mod action (if implemented)
1. Broadcaster or officer uses "Ban from chat" or "Mute" on a user
2. Banned user attempts to send chat

### Expected:
- Message blocked locally for that user
- Other users unaffected

---

## Test Case 9: Rate Limiting / Spam Protection

### Steps:
1. Viewer rapidly sends 10 messages within a few seconds
2. Check if anti-spam triggers

### Expected:
- After ~5 rapid messages, clicking sends shows error: "You're sending messages too fast"
- Cooldown period (e.g., 30 sec) before can send again
- Toast notification warns user

---

## Test Case 10: Troll Toe Viewer Joins Side & Uses Fog

### Steps:
1. Troll Toe game started, phase = `filling` or `live`
2. Viewer clicks "Join Broadcaster Team" or "Join Challenger Team"
3. Viewer assigned to a box (queued → assigned)
4. If `fogEnabled`, viewer with sufficient coins clicks Fog on occupied box

### Expected:
- Side selection works
- Viewer status updates: `idle` → `queued` → `assigned`
- Fog deducts coins, removes target player
- Cooldown timer applies per user

---

## Test Checklist

### Broadcaster Actions
- [ ] Start/stop stream
- [ ] Enable paid chat (per-user & per-message)
- [ ] Set paid chat price
- [ ] Start battle (1v1, 2v2)
- [ ] Start Troll Toe game
- [ ] Use fog (if host)
- [ ] Add/deduct broadcast boxes
- [ ] Kick/ban user from chat

### Viewer Actions
- [ ] Join stream
- [ ] Send free chat (no paid chat)
- [ ] Pay for chat access (per-user or per-message)
- [ ] Join Troll Toe side
- [ ] Use Fog (if enabled and has coins)
- [ ] Send messages rapidly (test rate limit)

### Officer Actions
- [ ] Bypass paid chat requirement
- [ ] Disable chat for specific user (if implemented)
- [ ] Access officer controls

---

## Database Verification (Optional)

Check these tables after tests:
```sql
-- Chat messages sent
SELECT * FROM chat_messages WHERE stream_id = '...' ORDER BY created_at DESC LIMIT 20;

-- Paid chat ledger (if separate)
SELECT * FROM chat_payments WHERE stream_id = '...';

-- Stream settings
SELECT paid_chat_enabled, paid_chat_type, paid_chat_price FROM stream_settings WHERE stream_id = '...';

-- User balances
SELECT troll_coins FROM user_profiles WHERE id = '...';

-- Seat sessions for Troll Toe
SELECT * FROM stream_seat_sessions WHERE stream_id = '...';
```

---

## Known Issues / Edge Cases
- Paid chat may not persist across page reloads if `stream_settings` not saved
- Rate limiting only applies to likes, not chat (verify if chat also has rate limit)
- Troll officer bypass logic verified in `BroadcastControls.tsx` lines 214-216

---

## Tester Profile Matrix
| Role | Expected Chat Behavior |
|------|------------------------|
| Regular User (no paid chat) | Free chat |
| Paid Chat - Per User | Pay once → unlimited messages |
| Paid Chat - Per Chat | Pay per message |
| Troll Officer / Lead Officer | Free chat (bypass) |
| Jailed User | Cannot chat |
| Viewer not on stage | Can chat (depending on paid settings) |

---

**End of Test Plan**.
