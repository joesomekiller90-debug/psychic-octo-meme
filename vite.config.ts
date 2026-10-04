import { defineConfig } from 'vitest/config';

// Preact via the automatic JSX runtime; no extra plugin needed.
export default defineConfig({
  base: './',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
