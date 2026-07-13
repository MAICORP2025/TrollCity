# Admin Supabase Usage Dashboard

## What is implemented
- Centralized pricing configuration in src/lib/supabasePricing.ts
- Pure cost calculation helpers with unit tests in src/lib/__tests__/supabasePricing.test.ts
- Server-side admin-only Express endpoints for summary, breakdown, historical, and refresh under /api/admin/supabase-usage/*
- A new admin-only dashboard page at /admin/supabase-usage

## Notes on data availability
- The current implementation uses server-side estimated snapshots rather than live Supabase billing APIs.
- Live billing instrumentation remains unavailable in this workspace unless the runtime environment provides a billing token or direct Supabase project access.
- The dashboard intentionally avoids exposing service secrets to the browser.

## Verification checklist
- [x] Jest unit tests for pricing utilities pass
- [x] Server endpoints are mounted and require admin verification
- [x] Admin route exists in the app router
- [ ] Run full build and type-check checks in the workspace
