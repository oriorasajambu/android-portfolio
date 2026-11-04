import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/android-portfolio/`,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } }],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}/android-portfolio/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
