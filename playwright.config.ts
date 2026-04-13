import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run sequentially to avoid server conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker — game requires sequential browser interaction
  timeout: 1_800_000, // 30 minutes for full game tests
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:1999',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['iPhone 13'], // Mobile viewport (375x812 portrait)
        browserName: 'chromium',
      },
    },
  ],

  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:1999',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
