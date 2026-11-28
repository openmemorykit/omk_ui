import { describe, expect, it } from 'vitest'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { createGlyphStoreFake } from './glyph-store-fake'

describe('GlyphStore fake', () => {
  it('reads nothing until a set is written, then reads it back', () => {
    const glyphs = createGlyphStoreFake()
    expect(glyphs.read()).toBeNull()
    glyphs.write(GlyphSet.PlayStation)
    expect(glyphs.read()).toBe(GlyphSet.PlayStation)
    expect(glyphs.writes).toStrictEqual([GlyphSet.PlayStation])
  })

  it('can start with a stored set', () => {
    expect(createGlyphStoreFake(GlyphSet.Xbox).read()).toBe(GlyphSet.Xbox)
  })
})
