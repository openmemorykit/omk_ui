import { statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FontFamily } from '../../../src/shared/config/theme-defaults'
import { fontFaceCss } from '../../../src/page/theme/font-face'
import fonts from '../../../src/page/theme/fonts.json'
import { readTokens } from './css-reading'
import { readSource } from './read-source'

const KIBIBYTE = 1024
const BUDGET_KIBIBYTES = 150
const FONT_BUDGET = BUDGET_KIBIBYTES * KIBIBYTE
const SOFIA_WEIGHTS = 4
const ARCHIVO_WEIGHTS = 3
const tokens = readTokens(readSource('src/page/theme/tokens.css'))

describe('fontFaceCss', () => {
  it('declares one rule per weight, with block display and a relative url', () => {
    const css = fontFaceCss(FontFamily.SofiaSansSemiCondensed, '')
    expect(css.match(/@font-face/g)).toHaveLength(SOFIA_WEIGHTS)
    expect(css.match(/font-display:\s*block/g)).toHaveLength(SOFIA_WEIGHTS)
    expect(css).toContain("url('fonts/sofia-sans-semi-condensed-latin-800-normal.woff2')")
    expect(css).toContain("font-family: 'Sofia Sans Semi Condensed'")
    expect(css).toContain("format('woff2')")
  })

  it('declares only the requested family', () => {
    const css = fontFaceCss(FontFamily.ArchivoNarrow, '')
    expect(css).toContain('Archivo Narrow')
    expect(css).not.toContain('Sofia')
    expect(css.match(/@font-face/g)).toHaveLength(ARCHIVO_WEIGHTS)
  })

  it('prefixes the urls with the base', () => {
    expect(fontFaceCss(FontFamily.ArchivoNarrow, './')).toContain("url('./fonts/archivo-narrow-latin-500-normal.woff2')")
  })

  it('cannot be broken out of by a base containing a quote', () => {
    const css = fontFaceCss(FontFamily.ArchivoNarrow, "x');}body{display:none}/*")
    expect(css).not.toContain("x')")
    expect(css.match(/@font-face/g)).toHaveLength(ARCHIVO_WEIGHTS)
  })
})

describe('fonts.json', () => {
  it('lists exactly the theme families', () => {
    expect(Object.keys(fonts).sort()).toEqual(Object.values(FontFamily).sort())
  })

  it('delivers every weight the theme uses, or its nearest lighter weight when the family has none heavier', () => {
    const used = Array.from(tokens).filter(([name]) => name.startsWith('font-weight-')).map(([, value]) => value)
    expect(used).toEqual(['500', '600', '700', '800'])
    expect(Object.keys(fonts.sofiaSansSemiCondensed.weights)).toEqual(used)
    expect(Object.keys(fonts.archivoNarrow.weights)).toEqual(used.slice(0, ARCHIVO_WEIGHTS))
  })

  it('keeps both families and their licences under the budget', () => {
    const sizes = Object.values(fonts).flatMap((family) =>
      Object.values(family.weights).map((file) => statSync(`node_modules/${family.package}/files/${file}`).size),
    )
    const licences = Object.values(fonts).map((family) => statSync(`node_modules/${family.package}/LICENSE`).size)
    expect([...sizes, ...licences].reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(FONT_BUDGET)
  })
})
