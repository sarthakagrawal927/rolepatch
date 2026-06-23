import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Plain Vitest config (formerly @saas-maker/test-config/vitest factory).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '__tests__/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.next', '.wrangler', 'e2e/**', '.claude/**', 'extension/**'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/**/index.ts',
        'src/**/*.config.{ts,js}',
        'src/**/__tests__/**',
        'src/lib/**/*.sql',
        'src/lib/isomorphic-ws-shim.js',
      ],
      thresholds: {
        lines: 20,
        functions: 25,
      },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
