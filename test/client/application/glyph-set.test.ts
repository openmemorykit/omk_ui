import { afterEach, describe, expect, it } from 'vitest'
import { changeGlyphSet, parseGlyphSet } from '../../../src/client/application/glyph-set'
import { FALLBACK_LOCALE, LOCALE_CONVAR } from '../../../src/client/application/requested-locale'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { expectKeepInputNeverTurnedOn, watchedPorts } from './watched-ports'

const FRENCH = { language: 'fr', messages: { 'glyphs.usage': 'Utilisation : /omk_glyphs xbox|playstation', 'glyphs.changed': 'Icônes de manette : {glyphSet}', 'glyphs.set.playStation': 'PlayStation', 'glyphs.set.xbox': 'Xbox' } }
const ENGLISH = { language: FALLBACK_LOCALE, messages: { 'glyphs.usage': 'Usage: /omk_glyphs xbox|playstation', 'glyphs.changed': 'Controller icons: {glyphSet} {unknown}' } }

afterEach(expectKeepInputNeverTurnedOn)

function frenchPorts(): ReturnType<typeof watchedPorts> {
  const ports = watchedPorts()
  ports.locales.setBundle(FRENCH.language, FRENCH)
  ports.locales.setBundle(ENGLISH.language, ENGLISH)
  ports.convars.set(LOCALE_CONVAR, FRENCH.language)
  return ports
}

describe('parseGlyphSet', () => {
  it.each([
    ['xbox', GlyphSet.Xbox],
    ['XBOX', GlyphSet.Xbox],
    ['playstation', GlyphSet.PlayStation],
    ['PlayStation', GlyphSet.PlayStation],
  ])('reads %s', (word, expected) => {
    expect(parseGlyphSet(word)).toBe(expected)
  })

  it.each([undefined, '', 'switch', 'toString', '__proto__'])('refuses %s', (word) => {
    expect(parseGlyphSet(word)).toBeNull()
  })
})

describe('changeGlyphSet', () => {
  it('writes the KVP, tells the page and confirms in the player language', () => {
    const ports = frenchPorts()
    changeGlyphSet(ports, ['playstation'])
    expect(ports.glyphs.writes).toStrictEqual([GlyphSet.PlayStation])
    expect(ports.nui.sentOfType(ToPage.GlyphSet)).toStrictEqual([{ type: ToPage.GlyphSet, glyphSet: GlyphSet.PlayStation }])
    expect(ports.console.printed).toStrictEqual(['Icônes de manette : PlayStation'])
  })

  it('prints the usage and changes nothing on a wrong word', () => {
    const ports = frenchPorts()
    changeGlyphSet(ports, ['gamecube'])
    changeGlyphSet(ports, [])
    expect(ports.glyphs.writes).toStrictEqual([])
    expect(ports.nui.sent).toStrictEqual([])
    expect(ports.console.printed).toStrictEqual([FRENCH.messages['glyphs.usage'], FRENCH.messages['glyphs.usage']])
  })

  it('falls back to English, then to the key, and leaves an unknown placeholder alone', () => {
    const ports = watchedPorts()
    ports.locales.setBundle(ENGLISH.language, ENGLISH)
    ports.convars.set(LOCALE_CONVAR, 'de')
    changeGlyphSet(ports, ['xbox'])
    expect(ports.console.printed).toStrictEqual(['Controller icons: glyphs.set.xbox {unknown}'])
  })

  it('reads the language the way the boot message does: a convar that is not a language name asks for English only', () => {
    const ports = watchedPorts()
    ports.locales.setBundle(ENGLISH.language, ENGLISH)
    ports.convars.set(LOCALE_CONVAR, '../not a language')
    changeGlyphSet(ports, ['gamecube'])
    expect(ports.locales.requested).toStrictEqual([FALLBACK_LOCALE])
    expect(ports.console.printed).toStrictEqual([ENGLISH.messages['glyphs.usage']])
  })

  it('prints the bare key when no bundle is readable', () => {
    const ports = watchedPorts()
    changeGlyphSet(ports, ['nope'])
    expect(ports.locales.requested).toStrictEqual([FALLBACK_LOCALE, FALLBACK_LOCALE])
    expect(ports.console.printed).toStrictEqual(['glyphs.usage'])
  })
})
