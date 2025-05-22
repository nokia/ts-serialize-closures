import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    onConsoleLog(log, type) {
      console.log(`[${type}] ${log}`);
      return true;
    },
  },
});