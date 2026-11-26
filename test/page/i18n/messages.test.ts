import { describe, expect, expectTypeOf, it } from 'vitest'
import { ItemKind, NotificationTone, RuleKind, TextFormat } from '@openmemorykit/ui/contract'
import english from '../../../omk_ui/locales/en.json'
import french from '../../../omk_ui/locales/fr.json'
import { KeyGlyph, LegendAction, PadGlyph } from '../../../src/page/domain/legend'
import { KeyboardLayer } from '../../../src/page/domain/keyboard-layouts'
import { Announcement } from '../../../src/page/domain/ui-effects'
import type { MessageKey } from '../../../src/page/i18n/messages'
import type { Translator } from '../../../src/page/i18n/messages'
import { createTranslator } from '../../../src/page/i18n/translator'

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g
const TWO = 2
const THREE = 3
const FORMAL_YOU = /\b(vous|votre|vos)\b/i
const PLURAL_SUFFIX = /\.(one|other)$/

const frMessages: Readonly<Record<string, string>> = french
const enMessages: Readonly<Record<string, string>> = english
const frKeys = Object.keys(frMessages)

const paramsOf = (text: string): string[] => [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? ''))].sort()
const baseKeys = new Set(frKeys.map((key) => key.replace(PLURAL_SUFFIX, '')))
const vocabulary = (prefix: string, values: Readonly<Record<string, string>>): string[] => Object.values(values).map((value) => `${prefix}.${value}`)

describe('locale files', () => {
  it('have the same keys in fr and en', () => {
    expect(Object.keys(enMessages).sort()).toEqual([...frKeys].sort())
  })

  it('have the same parameters for every key', () => {
    for (const key of frKeys) {
      expect(paramsOf(enMessages[key] ?? ''), key).toEqual(paramsOf(frMessages[key] ?? ''))
    }
  })

  it('give both plural forms to every plural key', () => {
    for (const key of frKeys.filter((candidate) => PLURAL_SUFFIX.test(candidate))) {
      const base = key.replace(PLURAL_SUFFIX, '')
      expect(frKeys, base).toContain(`${base}.one`)
      expect(frKeys, base).toContain(`${base}.other`)
    }
  })

  it('prefix every key with ui. and leave log.* to milestone 3', () => {
    expect(frKeys.every((key) => key.startsWith('ui.'))).toBe(true)
  })

  it('never use "vous" in french', () => {
    expect(Object.values(frMessages).filter((text) => FORMAL_YOU.test(text))).toEqual([])
  })

  it('has no empty message', () => {
    expect([...Object.values(frMessages), ...Object.values(enMessages)].filter((text) => text.trim().length === 0)).toEqual([])
  })
})

describe('vocabulary coverage', () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ['LegendAction', vocabulary('ui.legend', LegendAction)],
    ['RuleKind', vocabulary('ui.rule', RuleKind)],
    ['TextFormat', vocabulary('ui.format', TextFormat)],
    ['NotificationTone', vocabulary('ui.tone', NotificationTone)],
    ['Announcement', vocabulary('ui.announce', Announcement)],
    ['KeyboardLayer', vocabulary('ui.keyboard.layer', KeyboardLayer)],
    ['PadGlyph', vocabulary('ui.glyph.pad', PadGlyph)],
    ['KeyGlyph', vocabulary('ui.glyph.key', KeyGlyph)],
    ['abandonText', ['ui.abandonText.title', 'ui.abandonText.text', 'ui.abandonText.confirm', 'ui.abandonText.cancel']],
    ['form', ['ui.form.errorCount', 'ui.form.noReply', 'ui.form.counter']],
    ['confirm defaults', ['ui.confirm.confirm', 'ui.confirm.cancel']],
  ]

  it.each(cases)('has a key for every %s member', (_name, keys) => {
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect(baseKeys, key).toContain(key)
  })

  it('knows the item kinds it does not translate', () => {
    expect(Object.values(ItemKind).length).toBeGreaterThan(0)
  })
})

describe('MessageKey', () => {
  it('keeps the base of plural keys and drops the suffixes', () => {
    expectTypeOf<'ui.form.errorCount'>().toExtend<MessageKey>()
    expectTypeOf<'ui.legend.aim'>().toExtend<MessageKey>()
    expectTypeOf<'ui.form.errorCount.one'>().not.toExtend<MessageKey>()
    expectTypeOf<'ui.form.errorCount.other'>().not.toExtend<MessageKey>()
    expect(true).toBe(true)
  })
})

describe('real bundles through the translator', () => {
  const load = (language: string, messages: Readonly<Record<string, string>>): Translator => {
    const translator = createTranslator(() => undefined)
    translator.load({ language, messages })
    return translator
  }

  it('renders the french error count with 0 and 1 singular', () => {
    const translator = load('fr', frMessages)
    expect(translator.translate('ui.form.errorCount', { count: 0 })).toBe('0 champ à corriger')
    expect(translator.translate('ui.form.errorCount', { count: 1 })).toBe('1 champ à corriger')
    expect(translator.translate('ui.form.errorCount', { count: THREE })).toBe('3 champs à corriger')
  })

  it('renders the english error count and the counter', () => {
    const translator = load('en', enMessages)
    expect(translator.translate('ui.form.errorCount', { count: 1 })).toBe('1 field to fix')
    expect(translator.translate('ui.form.errorCount', { count: TWO })).toBe('2 fields to fix')
    expect(translator.translate('ui.form.counter', { current: 3, total: 12 })).toBe('3/12')
  })
})
