import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.vitest.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage/vitest',
      include: ['src/server/**', 'src/modules/**'],
      exclude: ['src/tests/**', 'dist/**', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@parkly/gate-core': path.resolve(__dirname, '../../packages/gate-core/src/index.ts'),
      '@parkly/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
})
