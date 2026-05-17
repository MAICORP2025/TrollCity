import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Storage state for logged-in users can be pre-seeded
    // storageState: {
    //   cookies: [],
    //   localStorage: [],
    // },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Wait for any network idle before considering page stable
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Global setup - seed test users before tests run
  // Run: npx playwright test --global-setup=scripts/playwright-setup.ts
  globalSetup: require.resolve('./scripts/playwright-setup'),

  // Global teardown - clean up test data
  globalTeardown: require.resolve('./scripts/playwright-teardown'),
});
