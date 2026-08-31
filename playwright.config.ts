import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.CTD_E2E_PORT ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Browser smoke suite.
 *
 * Runs against the production build, because the things worth catching here
 * are integration failures — the engine mounting, the save round-tripping,
 * the simulation clock actually freezing — not component behaviour, which the
 * Vitest suite already covers.
 *
 * `npm run test:e2e` builds and serves automatically. A one-time
 * `npx playwright install chromium` is needed on a fresh machine.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Containers and CI runners have no GPU; keep WebGL available.
        launchOptions: {
          args: [
            '--use-gl=swiftshader',
            '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage',
            '--disable-background-networking',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
