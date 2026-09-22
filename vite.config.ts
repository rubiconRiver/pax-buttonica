/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The browser tests in e2e/ belong to Playwright, not vitest.
  test: { include: ['src/**/*.test.ts'] },
});
