import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const DOM_TESTS = ['test/page/{components,infrastructure,composition}/**/*.test.ts', 'test/preview/shell/**/*.test.ts']

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/*/domain/**',
        'src/*/application/**',
        'src/page/i18n/**',
        'src/protocol/**',
        'src/shared/**',
        'preview/runtime/**',
      ],
      thresholds: { lines: 95, branches: 95 },
    },
    projects: [
      {
        test: {
          name: 'node',
          include: ['test/**/*.test.ts'],
          exclude: DOM_TESTS,
          environment: 'node',
          server: { deps: { inline: [/@openmemorykit\//] } },
        },
      },
      {
        plugins: [vue()],
        test: {
          name: 'dom',
          include: DOM_TESTS,
          environment: 'happy-dom',
          server: { deps: { inline: [/@openmemorykit\//] } },
        },
      },
    ],
  },
})
