import { defineConfig, devices } from '@playwright/test'

// ───────────────────────────────────────────
// Playwright config — smoke suite only.
//
// What this covers: critical happy paths (login, navigate to each
// major surface, basic create flow). NOT a full coverage suite — we'd
// add Cypress or Vitest UI for component-level testing later.
//
// Run locally: `npm run test:e2e` (boots dev server + server)
// Run in CI:   GitHub Actions with the `run-e2e` PR label.
// ───────────────────────────────────────────

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false, // smoke suite — keep deterministic
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Spin up dev server + API for local runs. In CI we boot them
  // separately via the workflow so we can run db push between.
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'npm run dev --workspace=server',
          url: 'http://localhost:4000/api/v1/health',
          reuseExistingServer: true,
          timeout: 60_000,
          cwd: '..',
        },
        {
          command: 'npm run dev --workspace=client',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 60_000,
          cwd: '..',
        },
      ],
})
