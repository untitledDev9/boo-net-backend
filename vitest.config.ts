import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/globalSetup.ts'],
    include: ['tests/**/*.test.ts'],
    fileParallelism: false, // one shared in-memory MongoDB; run files one at a time (this machine has little RAM)
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
