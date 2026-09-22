import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
    conditions: ['react-server'],
  },
  test: {
    environment: 'node',
    include: ['src/integration/staging.smoke.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 90_000,
    testTimeout: 90_000,
  },
})
