import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { name: 'ui-resource', include: ['test/**/*.test.ts'], environment: 'node' } })
