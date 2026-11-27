import { describe, expect, it } from 'vitest'
import { LocaleWarningKind, type LocaleWarning } from '../../../src/shared/locales/locale-warning'
import { createMergedLocaleSource } from '../../../src/shared/locales/merged-locale-source'

const LOWERCASE_A = 97
const ENGLISH = { 'ui.close': 'Close', 'log.line': 'Line {text}', 'keybind.radial': 'Radial' }

function readerOf(reads: string[], files: Readonly<Record<string, unknown>>): (path: string) => string | null {
  return (path) => {
    reads.push(path)
    const content = Object.getOwnPropertyDescriptor(files, path)?.value as unknown
    return content === undefined ? null : JSON.stringify(content)
  }
}

describe('createMergedLocaleSource', () => {
  it('reads the files of a language once and serves the cache afterwards', () => {
    const reads: string[] = []
    const source = createMergedLocaleSource({ readFile: readerOf(reads, { 'locales/en.json': ENGLISH }), onWarning: () => undefined })
    const first = source.read('en')
    const readsAfterFirst = reads.length
    expect(source.read('en')).toBe(first)
    expect(reads.length).toBe(readsAfterFirst)
  })

  it('sends each warning once, when the language is first merged', () => {
    const warnings: LocaleWarning[] = []
    const source = createMergedLocaleSource({ readFile: readerOf([], { 'locales/en.json': ENGLISH }), onWarning: (warning) => warnings.push(warning) })
    source.read('de')
    source.read('de')
    expect(warnings.map((warning) => warning.kind)).toEqual([LocaleWarningKind.LanguageUnavailable])
  })

  it('serves the same bundle for every invalid name', () => {
    const source = createMergedLocaleSource({ readFile: readerOf([], { 'locales/en.json': ENGLISH }), onWarning: () => undefined })
    expect(source.read('../x')).toBe(source.read('Y'))
  })

  it('returns null when the English file is unreadable', () => {
    expect(createMergedLocaleSource({ readFile: () => null, onWarning: () => undefined }).read('en')).toBeNull()
  })

  it('drops the keys the caller does not want, and the warnings about them', () => {
    const warnings: LocaleWarning[] = []
    const files = { 'locales/en.json': ENGLISH, 'locales/overrides/en.json': { 'log.nothing': 'x', 'ui.nothing': 'x' } }
    const source = createMergedLocaleSource({ readFile: readerOf([], files), onWarning: (warning) => warnings.push(warning), includesKey: (key) => !key.startsWith('log.') })
    expect(source.read('en')?.messages).toEqual({ 'ui.close': 'Close', 'keybind.radial': 'Radial' })
    expect(warnings.map((warning) => warning.key)).toEqual(['ui.nothing'])
  })

  it('never throws, even when the warning handler does', () => {
    const source = createMergedLocaleSource({ readFile: readerOf([], { 'locales/en.json': ENGLISH }), onWarning: () => { throw new Error('boom') } })
    expect(source.read('de')?.language).toBe('en')
  })

  it('never throws when the file reader does', () => {
    const source = createMergedLocaleSource({ readFile: () => { throw new Error('boom') }, onWarning: () => undefined })
    expect(source.read('en')).toBeNull()
  })

  it('keeps its cache bounded', () => {
    const reads: string[] = []
    const source = createMergedLocaleSource({ readFile: readerOf(reads, { 'locales/en.json': ENGLISH }), onWarning: () => undefined })
    const names = Array.from({ length: 17 }, (_item, index) => `a${String.fromCharCode(LOWERCASE_A + index)}`)
    names.forEach((name) => source.read(name))
    const readsBefore = reads.length
    source.read(names[0] as string)
    expect(reads.length).toBeGreaterThan(readsBefore)
  })
})
