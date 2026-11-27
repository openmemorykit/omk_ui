import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from '../../../src/page/i18n/translator'
import type { MessageKey, Translator } from '../../../src/page/i18n/messages'

const asKey = (key: string): MessageKey => key as MessageKey

const TWO = 2

function loaded(language: string, messages: Record<string, string>, onMissing: (key: string) => void = () => undefined): Translator {
  const translator = createTranslator(onMissing)
  translator.load({ language, messages })
  return translator
}

describe('translator', () => {
  it('returns a plain message', () => {
    expect(loaded('en', { 'ui.a': 'Hello' }).translate(asKey('ui.a'))).toBe('Hello')
  })

  it('interpolates named parameters, numbers included', () => {
    const translator = loaded('en', { 'ui.a': '{current}/{total} of {name}' })
    expect(translator.translate(asKey('ui.a'), { current: 3, total: 12, name: 'x' })).toBe('3/12 of x')
  })

  it('keeps a placeholder without parameter as written', () => {
    expect(loaded('en', { 'ui.a': 'Hi {name}' }).translate(asKey('ui.a'), {})).toBe('Hi {name}')
  })

  it('does not substitute inherited names', () => {
    const translator = loaded('en', { 'ui.a': '{constructor} {toString} {__proto__}' })
    expect(translator.translate(asKey('ui.a'), { other: 'x' })).toBe('{constructor} {toString} {__proto__}')
  })

  it('ignores a __proto__ parameter without polluting', () => {
    const params = JSON.parse('{"__proto__":{"polluted":"yes"},"name":"ok"}') as Record<string, string>
    const translator = loaded('en', { 'ui.a': 'Hi {name} {polluted}' })
    expect(translator.translate(asKey('ui.a'), params)).toBe('Hi ok {polluted}')
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('picks the english plural forms', () => {
    const translator = loaded('en', { 'ui.n.one': '{count} item', 'ui.n.other': '{count} items' })
    expect(translator.translate(asKey('ui.n'), { count: 1 })).toBe('1 item')
    expect(translator.translate(asKey('ui.n'), { count: 0 })).toBe('0 items')
    expect(translator.translate(asKey('ui.n'), { count: 5 })).toBe('5 items')
  })

  it('treats 0 and 1 as singular in french', () => {
    const translator = loaded('fr', { 'ui.n.one': '{count} champ', 'ui.n.other': '{count} champs' })
    expect(translator.translate(asKey('ui.n'), { count: 0 })).toBe('0 champ')
    expect(translator.translate(asKey('ui.n'), { count: 1 })).toBe('1 champ')
    expect(translator.translate(asKey('ui.n'), { count: TWO })).toBe('2 champs')
  })

  it('falls back to other when the category has no form', () => {
    const translator = loaded('fr', { 'ui.n.other': '{count} champs' })
    expect(translator.translate(asKey('ui.n'), { count: 1 })).toBe('1 champs')
  })

  it('uses the plain key when count is not a number', () => {
    const translator = loaded('en', { 'ui.n': 'plain', 'ui.n.other': 'plural' })
    expect(translator.translate(asKey('ui.n'), { count: 'x' })).toBe('plain')
  })

  it('falls back to other for an invalid language tag', () => {
    const translator = loaded('not a locale!', { 'ui.n.one': 'one', 'ui.n.other': 'other' })
    expect(translator.translate(asKey('ui.n'), { count: 1 })).toBe('one')
  })

  it('returns the key itself and reports it once', () => {
    const onMissing = vi.fn()
    const translator = loaded('en', {}, onMissing)
    expect(translator.translate(asKey('ui.unknown'))).toBe('ui.unknown')
    translator.translate(asKey('ui.unknown'))
    translator.translate(asKey('ui.other'))
    expect(onMissing.mock.calls).toEqual([['ui.unknown'], ['ui.other']])
  })

  it('does not resolve inherited keys', () => {
    const onMissing = vi.fn()
    const translator = loaded('en', {}, onMissing)
    expect(translator.translate(asKey('constructor'))).toBe('constructor')
    expect(translator.translate(asKey('__proto__'))).toBe('__proto__')
    expect(onMissing).toHaveBeenCalledTimes(TWO)
  })

  it('reports a missing plural form by its base key', () => {
    const onMissing = vi.fn()
    const translator = loaded('en', {}, onMissing)
    expect(translator.translate(asKey('ui.n'), { count: TWO })).toBe('ui.n')
    expect(onMissing).toHaveBeenCalledWith('ui.n')
  })

  it('translates before any load as missing', () => {
    const onMissing = vi.fn()
    expect(createTranslator(onMissing).translate(asKey('ui.a'))).toBe('ui.a')
    expect(onMissing).toHaveBeenCalledTimes(1)
  })

  it('replaces the previous bundle on load', () => {
    const translator = loaded('en', { 'ui.a': 'old' })
    translator.load({ language: 'fr', messages: JSON.parse('{"ui.b":"neuf","__proto__":"x"}') as Record<string, string> })
    expect(translator.translate(asKey('ui.b'))).toBe('neuf')
    expect(translator.translate(asKey('ui.a'))).toBe('ui.a')
  })

  it('forgets reported keys when a new bundle is loaded', () => {
    const onMissing = vi.fn()
    const translator = loaded('en', {}, onMissing)
    translator.translate(asKey('ui.a'))
    translator.load({ language: 'en', messages: {} })
    translator.translate(asKey('ui.a'))
    expect(onMissing).toHaveBeenCalledTimes(TWO)
  })
})
