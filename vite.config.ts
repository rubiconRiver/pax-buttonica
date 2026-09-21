/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Browser tests swap the WebRTC library for one that talks between tabs; see e2e/fake-peerjs.ts.
    alias: process.env.E2E_FAKE_PEER ? { peerjs: fileURLToPath(new URL('./e2e/fake-peerjs.ts', import.meta.url)) } : {},
  },
  // The browser tests in e2e/ belong to Playwright, not vitest.
  test: { include: ['src/**/*.test.ts'] },
});
