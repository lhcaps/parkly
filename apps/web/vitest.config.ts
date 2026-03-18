import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    clearMocks: true,
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/*.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: [
        'src/lib/auth/**/*.ts',
        'src/features/auth/**/*.ts',
        'src/features/subscriptions/**/*.ts',
        'src/features/parking-live/**/*.ts',
      ],
    },
  },
})
