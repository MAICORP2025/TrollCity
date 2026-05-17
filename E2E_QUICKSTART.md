# Quick Start: E2E Testing

## 1️⃣ Prerequisites

- **Supabase** running locally or cloud with required tables
- **Dev server** running on `http://localhost:5173`
- **Environment variables** in `.env`:
  ```bash
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...  # for seeding
  ```

## 2️⃣ Seed Test Data

```bash
# Create test users and streams
npm run seed:test-users
```

This creates:
- `viewer.rich@test.troll` (500 coins)
- `viewer.poor@test.troll` (10 coins)
- `officer@test.troll` (troll_officer)
- `lead@test.troll` (lead_troll_officer)
- `jailed@test.troll` (restricted)
- `broadcaster@test.troll` (broadcaster)

And these seeded streams:
- `seed-test-stream-1` (general)
- `free-chat-stream`
- `paid-per-user-stream`
- `paid-per-message-stream`
- `battle-active-stream`
- `trolltoe-active-stream`

## 3️⃣ Start Dev Server

```bash
npm run dev
```

Keep this running in a separate terminal.

## 4️⃣ Run E2E Tests

```bash
# Install Playwright browsers if not done
npx playwright install chromium

# Run all E2E tests
npm run test:smoke

# Or run specific test file
npx playwright test tests/broadcast/viewer-page.spec.ts

# With UI (interactive)
npx playwright test --ui
```

## 5️⃣ View Results

- HTML report: `playwright-report/index.html`
- Screenshots: `test-results/` (if added in tests)

---

## 🧩 What's Being Tested

| Test File | Coverage |
|-----------|----------|
| `chat.spec.ts` | Free chat, officer bypass, jailed user, broadcaster toggle paid chat |
| `paid-chat.spec.ts` | Per-user/per-message payments, officer bypass, toggle |
| `viewer-page.spec.ts` | Troll Toe UI, Fog coins check, battle overlay, box count sync, rate limiting |

---

## 🐛 Troubleshooting

**Tests can't find elements:** Ensure you're using the correct selectors. Add `data-testid` attributes to components if selectors are flaky.

**Auth redirects to /auth?error:** Check Supabase credentials and that test users exist.

**Stream not found:** Verify seeded stream IDs match those used in tests (`seed-test-stream-1`, etc.).

**Paid chat modal not appearing:** Make sure `stream_settings` was seeded with `paid_chat_enabled = true`.

---

**All set! Run `npm run test:smoke` to see your tests in action.**
