import { describe, expect, it } from 'vitest'
import { LocaleWarningKind, type LocaleWarning } from '../../../src/shared/locales/locale-warning'
import { mergeLocale, type LocaleFileReader } from '../../../src/shared/locales/merge-locale'

const ENGLISH_PATH = 'locales/en.json'
const GERMAN_PATH = 'locales/de.json'
const GERMAN_OVERRIDES_PATH = 'locales/overrides/de.json'
const ENGLISH_OVERRIDES_PATH = 'locales/overrides/en.json'

const OVER_SIZE_LIMIT = 300_000
const WARNINGS_CAP_WITH_MARKER = 21
const ENGLISH = { 'ui.close': 'Close', 'ui.title': 'Panel {title}', 'ui.count': '{count} of {total}' }

function filesOf(files: Readonly<Record<string, unknown>>): LocaleFileReader {
  return (path) => {
    const content = Object.getOwnPropertyDescriptor(files, path)?.value as unknown
    if (content === undefined) return null
    return typeof content === 'string' ? content : JSON.stringify(content)
  }
}

function kinds(warnings: readonly LocaleWarning[]): readonly LocaleWarningKind[] {
  return warnings.map((warning) => warning.kind)
}

describe('mergeLocale', () => {
  it('returns the English texts for English', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH }), 'en')
    expect(merged.bundle).toEqual({ language: 'en', messages: ENGLISH })
    expect(merged.warnings).toEqual([])
  })

  it('falls back to English when the requested language has no file', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH }), 'de')
    expect(merged.bundle).toEqual({ language: 'en', messages: ENGLISH })
    expect(kinds(merged.warnings)).toEqual([LocaleWarningKind.LanguageUnavailable])
  })

  it('shows the English text for a key missing from an incomplete language, never a raw key', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: { 'ui.close': 'Schliessen' } }), 'de')
    expect(merged.bundle).toEqual({ language: 'de', messages: { ...ENGLISH, 'ui.close': 'Schliessen' } })
    expect(merged.warnings).toEqual([])
  })

  it('applies an override over the chosen language', () => {
    const merged = mergeLocale(
      filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: { 'ui.close': 'Schliessen' }, [GERMAN_OVERRIDES_PATH]: { 'ui.close': 'Zu' } }),
      'de',
    )
    expect(merged.bundle?.messages['ui.close']).toBe('Zu')
  })

  it('applies the English override when the language is English', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [ENGLISH_OVERRIDES_PATH]: { 'ui.close': 'Shut' } }), 'en')
    expect(merged.bundle?.messages['ui.close']).toBe('Shut')
  })

  it('ignores the overrides of a language that fell back to English', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_OVERRIDES_PATH]: { 'ui.close': 'Zu' } }), 'de')
    expect(merged.bundle?.messages['ui.close']).toBe('Close')
  })

  it('ignores a key unknown to English in an override and reports it', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: {}, [GERMAN_OVERRIDES_PATH]: { 'ui.nothing': 'x' } }), 'de')
    expect(merged.bundle?.messages).toEqual(ENGLISH)
    expect(merged.warnings).toEqual([{ kind: LocaleWarningKind.UnknownKey, file: GERMAN_OVERRIDES_PATH, key: 'ui.nothing' }])
  })

  it('refuses a text whose parameters differ from English and reports it', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: { 'ui.title': 'Tafel {name}', 'ui.count': '{total} von {count}' } }), 'de')
    expect(merged.bundle?.messages['ui.title']).toBe('Panel {title}')
    expect(merged.bundle?.messages['ui.count']).toBe('{total} von {count}')
    expect(merged.warnings).toEqual([{ kind: LocaleWarningKind.ParameterMismatch, file: GERMAN_PATH, key: 'ui.title' }])
  })

  it('refuses a text that drops a parameter', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: { 'ui.title': 'Tafel' } }), 'de')
    expect(merged.bundle?.messages['ui.title']).toBe('Panel {title}')
  })

  it('keeps English and reports a value that is not a text', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: { 'ui.close': 3 } }), 'de')
    expect(merged.bundle?.messages['ui.close']).toBe('Close')
    expect(kinds(merged.warnings)).toEqual([LocaleWarningKind.NotText])
  })

  it('treats a key named __proto__ as unknown without touching the prototype', () => {
    const raw = '{"__proto__": "polluted", "ui.close": "Zu"}'
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: raw }), 'de')
    expect(kinds(merged.warnings)).toEqual([LocaleWarningKind.UnknownKey])
    expect(Object.getPrototypeOf(merged.bundle?.messages)).toBe(Object.prototype)
    expect(merged.bundle?.messages['ui.close']).toBe('Zu')
  })

  it('falls back to English and reports a malformed language file', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: '{broken' }), 'de')
    expect(merged.bundle?.language).toBe('en')
    expect(kinds(merged.warnings)).toEqual([LocaleWarningKind.FileMalformed, LocaleWarningKind.LanguageUnavailable])
  })

  it.each([['[]'], ['"text"'], ['null'], ['7']])('reports a language file that is not an object (%s)', (raw) => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: raw }), 'de')
    expect(merged.bundle?.language).toBe('en')
    expect(kinds(merged.warnings)).toContain(LocaleWarningKind.FileMalformed)
  })

  it('reports a malformed override and keeps the language', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: {}, [GERMAN_OVERRIDES_PATH]: 'nope' }), 'de')
    expect(merged.bundle?.language).toBe('de')
    expect(kinds(merged.warnings)).toEqual([LocaleWarningKind.FileMalformed])
  })

  it('reports a file over the size limit', () => {
    const huge = JSON.stringify({ 'ui.close': 'x'.repeat(OVER_SIZE_LIMIT) })
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: huge }), 'de')
    expect(merged.bundle?.language).toBe('en')
    expect(kinds(merged.warnings)).toContain(LocaleWarningKind.FileTooLarge)
  })

  it('returns no bundle when the English file is missing or broken', () => {
    expect(mergeLocale(filesOf({}), 'en')).toEqual({ bundle: null, warnings: [{ kind: LocaleWarningKind.FileUnreadable, file: ENGLISH_PATH }] })
    expect(mergeLocale(filesOf({ [ENGLISH_PATH]: '{' }), 'en').bundle).toBeNull()
  })

  it.each([['../secret'], ['DE'], ['de/../en'], [''], ['deu'], ['de_DE']])('never reads a path built from the invalid language "%s"', (requested) => {
    const read: string[] = []
    const merged = mergeLocale((path) => {
      read.push(path)
      return path === ENGLISH_PATH ? JSON.stringify(ENGLISH) : null
    }, requested)
    expect(read).toEqual([ENGLISH_PATH, ENGLISH_OVERRIDES_PATH])
    expect(merged.bundle?.language).toBe('en')
    expect(kinds(merged.warnings)).toEqual([LocaleWarningKind.LanguageUnavailable])
  })

  it('accepts a regional language name', () => {
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, 'locales/pt-BR.json': { 'ui.close': 'Fechar' } }), 'pt-BR')
    expect(merged.bundle).toEqual({ language: 'pt-BR', messages: { ...ENGLISH, 'ui.close': 'Fechar' } })
  })

  it('caps the warnings of a file full of unknown keys', () => {
    const unknown = Object.fromEntries(Array.from({ length: 100 }, (_item, index) => [`ui.nothing${index}`, 'x']))
    const merged = mergeLocale(filesOf({ [ENGLISH_PATH]: ENGLISH, [GERMAN_PATH]: unknown }), 'de')
    expect(merged.warnings.length).toBeLessThanOrEqual(WARNINGS_CAP_WITH_MARKER)
    expect(merged.warnings[merged.warnings.length - 1]?.kind).toBe(LocaleWarningKind.Truncated)
  })
})
