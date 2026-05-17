import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Playwright test teardown complete (keeping seeded data for reuse)');
  // Could optionally delete seeded data here if isolation is needed
}

export default globalTeardown;
