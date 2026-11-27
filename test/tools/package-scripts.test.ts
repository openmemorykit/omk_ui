import { describe, expect, it } from 'vitest'
import { readSource } from '../page/theme/read-source'

const scripts = (JSON.parse(readSource('package.json')) as { scripts: Record<string, string> }).scripts

describe('package scripts', () => {
  it.each(['build', 'build:preview', 'dev:preview'])('%s copies the fonts before running vite', (name) => {
    const line = scripts[name] ?? ''
    expect(line.startsWith('node tools/fonts.mjs && vite')).toBe(true)
  })
})

describe('scripts build', () => {
  it('builds dist/client.js and dist/server.js with tools/scripts.mjs', () => {
    expect(scripts['build:scripts']).toBe('node tools/scripts.mjs')
  })

  it('runs after the page build, in build', () => {
    expect(scripts['build']).toBe('node tools/fonts.mjs && vite build && npm run build:scripts')
  })

  it('stays out of the preview builds', () => {
    expect(scripts['build:preview']).not.toContain('build:scripts')
  })
})

describe('typecheck script', () => {
  const programs = readSource('tools/typecheck.mjs')

  it.each(['pure', 'test', 'client', 'server', 'test.client', 'test.server'])('checks the %s program with tsc', (name) => {
    expect(programs).toContain(`['tsc', '${name}']`)
  })

  it.each(['page', 'test.page'])('checks the %s program with vue-tsc', (name) => {
    expect(programs).toContain(`['vue-tsc', '${name}']`)
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
