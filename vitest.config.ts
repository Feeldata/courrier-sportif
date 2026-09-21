import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, 'src/**/*.node.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
