import { describe, expect, it } from 'vitest'
import { readSource } from '../page/theme/read-source'

const scripts = (JSON.parse(readSource('package.json')) as { scripts: Record<string, string> }).scripts

describe('package scripts', () => {
  it.each(['build', 'build:preview', 'dev:preview'])('%s copies the fonts before running vite', (name) => {
    const line = scripts[name] ?? ''
    expect(line.startsWith('node tools/fonts.mjs && vite')).toBe(true)
  })
})
