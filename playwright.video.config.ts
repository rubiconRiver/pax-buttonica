import { defineConfig } from '@playwright/test';

/** Not a test run: `npm run video` plays a scripted tour in a browser and records it. See video/README.md. */
const PORT = 5199;

export default defineConfig({
  testDir: 'video',
  testMatch: /tour\.ts$/,
  timeout: 420_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'video/out/raw',
  use: {
    baseURL: `http://localhost:${PORT}`,
    actionTimeout: 15_000,
    viewport: { width: 1920, height: 1080 },
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1'] },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { E2E_FAKE_PEER: '1' },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
