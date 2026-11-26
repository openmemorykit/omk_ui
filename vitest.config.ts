import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'omk_ui',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    server: { deps: { inline: [/@openmemorykit\//] } },
    coverage: {
      provider: 'v8',
      include: ['src/*/domain/**', 'src/*/application/**'],
      thresholds: { lines: 95, branches: 95 },
    },
  },
})
