import { describe, expect, it } from 'vitest'
import { readSource } from './read-source'

const baseCss = readSource('src/page/theme/base.css')
const tokensCss = readSource('src/page/theme/tokens.css')
const MAX_STACK_MS = 90
const ANIMATED_PROPERTIES = new Set(['opacity', 'transform'])

function keyframes(name: string): string {
  const start = baseCss.indexOf(`@keyframes ${name} `)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = baseCss.indexOf('{', start)
  const close = baseCss.indexOf('\n}', open)
  return baseCss.slice(open, close)
}

function declaredProperties(block: string): ReadonlySet<string> {
  return new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1] ?? ''))
}

describe('stacking animation of the column rows', () => {
  it.each([
    ['omk-push', 'omk-anim-push'],
    ['omk-pop', 'omk-anim-pop'],
  ])('animates %s with opacity and transform only', (name) => {
    expect(declaredProperties(keyframes(name))).toEqual(ANIMATED_PROPERTIES)
  })

  it.each([
    ['omk-push', 'omk-anim-push'],
    ['omk-pop', 'omk-anim-pop'],
  ])('plays %s at the fast duration, 90 ms at most', (name, className) => {
    expect(baseCss).toMatch(new RegExp(`\\.${className}\\s*\\{\\s*animation:\\s*${name}\\s+var\\(--fast\\)`))
    const fast = /--fast:\s*(\d+)ms/.exec(tokensCss)
    expect(Number(fast?.[1])).toBeLessThanOrEqual(MAX_STACK_MS)
  })

  it('moves the rows by transform, never by position or size', () => {
    for (const name of ['omk-push', 'omk-pop']) expect(keyframes(name)).toMatch(/transform:\s*translateX\(/)
  })
})
