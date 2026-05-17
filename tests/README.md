# E2E Test Suite - ViewerPage & Broadcast Features

## Quick Start

```bash
# 1. Start dev server
npm run dev

# 2. Seed test users (one-time)
npm run seed:e2e-users

# 3. Run all E2E tests
npm run test:smoke

# 4. Or run specific suite
npm run test:e2e -- --grep "Troll Toe"
```

## Prerequisites

- Supabase local or cloud instance with tables created
- Environment variables set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (for globalSetup seeding)
- Dev server running on `http://localhost:5173`
- Test users seeded (scripts/seed_test_users.ts)

## Test Structure

```
tests/
├── broadcast/
│   ├── chat.spec.ts           (basic chat scenarios)
│   ├── paid-chat.spec.ts      (paid chat, officer bypass)
│   ├── viewer-page.spec.ts    (Troll Toe, battle, box sync)
│   └── __fixtures__/          (test data)
├── selectors.ts               (CSS selectors & helpers)
└── pageObjects/
    └── ViewerPage.ts          (POM for ViewerPage)
scripts/
├── playwright-setup.ts        (globalSetup - seed users)
└── playwright-teardown.ts     (globalTeardown - cleanup)
playwright.config.ts           (Playwright config)
```

## Test Suites

### 1. `chat.spec.ts` - Basic Chat
- Regular user sends up to 5 free messages
- Officer bypasses paid chat
- Jailed user blocked

### 2. `paid-chat.spec.ts` - Paid Chat
- Per-user mode: pay once, unlimited messages
- Per-message mode: deduct per message
- Officer bypass verified
- Broadcaster can toggle paid chat

### 3. `viewer-page.spec.ts` - Full Integration
- Troll Toe viewer UI (join side, use Fog)
- Battle overlay + chat
- Real-time box count sync
- Rate limiting (5 messages limit)
- Paid chat restrictions

## Selectors Best Practice

Use the `selectors.ts` helpers instead of hard-coded CSS. Example:

```ts
import { selectors } from '../selectors';

await page.fill(selectors.auth.emailInput, 'user@test.troll');
await page.click(selectors.auth.signInButton);
await expect(page.locator(selectors.chat.paywallModal)).toBeVisible();
```

## Adding New Tests

1. Create a `describe` block with a clear scope
2. Use `login()` helper from `chat.spec.ts` or create your own
3. Use `joinStream()` to navigate to a test stream
4. Use `selectors` or `ViewerPage` POM for interactions
5. Add `test.skip()` or `test.fail()` as needed

## Troubleshooting

### Tests fail on auth redirect
Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly.

### Tests can't find chat input
The chat component may be hidden on some pages. Ensure you're on a broadcast watch page.

### Paid chat modal not appearing
Verify the stream has `paid_chat_enabled = true` in `stream_settings` table. Seed it in globalSetup.

### Rate limit not triggering
The rate limiter uses a 2-second window with 5 max clicks. Increase the loop speed or check cookie-based dedupe.

## Manual Testing Checklist

Even with E2E tests, manual verification on mobile/desktop is recommended:

- [ ] Troll Toe side selection visible to viewers
- [ ] Fog button shows correct coin cost
- [ ] Fog cooldown timer works
- [ ] Battle overlay (score + timer) appears
- [ ] Paid chat paywall modal looks correct
- [ ] Officer badge/role displays correctly
- [ ] Chat messages scroll smoothly

## CI Integration

Add to your CI pipeline:

```yaml
- name: Run E2E tests
  run: |
    npm ci
    npx playwright install --with-deps chromium
    npm run test:smoke
```

---

**Note**: Tests rely on seeded data. If a stream ID changes, update the constants in the spec files or parameterize via environment variables.
