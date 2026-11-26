import { describe, expect, it } from 'vitest'
import { readSource } from '../page/theme/read-source'

const scripts = (JSON.parse(readSource('package.json')) as { scripts: Record<string, string> }).scripts

describe('package scripts', () => {
  it.each(['build', 'build:preview', 'dev:preview'])('%s copies the fonts before running vite', (name) => {
    const line = scripts[name] ?? ''
    expect(line.startsWith('node tools/fonts.mjs && vite')).toBe(true)
  })
})

describe('check script', () => {
  const steps = (scripts['check'] ?? '').split(' && ')

  it('chains lint, typecheck, test, build, sizes, css-guard and version in order', () => {
    expect(steps).toEqual([
      'npm run lint',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'node tools/sizes.mjs omk_ui/web',
      'node tools/css-guard.mjs omk_ui/web/assets',
      'node tools/version.mjs',
    ])
  })

  it('runs check before the release archive', () => {
    expect(scripts['release']).toBe('npm run check && node tools/release.mjs')
  })
})

describe('capture script', () => {
  it('runs the capture tool', () => {
    expect(scripts['capture']).toBe('node tools/capture.mjs')
  })

  it('stays outside the check chain because captures are not part of CI', () => {
    expect(scripts['check']).not.toContain('capture')
  })
})
