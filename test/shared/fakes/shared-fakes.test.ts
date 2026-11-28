import { describe, expect, it } from 'vitest'
import { readConvar, ConvarBoolean } from '@openmemorykit/core/shared'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ConfigWarningKind } from '../../../src/shared/config/read-config'
import { createConfigSourceFake, VALID_DEFAULT_READING } from './config-source-fake'
import { createConvarSourceFake } from './convar-source-fake'
import { createLocaleSourceFake } from './locale-source-fake'

const FRENCH = { language: 'fr', messages: { 'log.trace.enabled': 'Journal activé' } }
const ENGLISH = { language: 'en', messages: {} }
const LOCALE_CONVAR = 'omk_ui_locale'
const PUSH_TO_TALK_CONVAR = 'omk_ui_ptt'

describe('ConfigSource fake', () => {
  it('reads the default configuration without warning, then the reading it is given', () => {
    const config = createConfigSourceFake()
    expect(config.read()).toBe(VALID_DEFAULT_READING)
    const warned = { config: DEFAULT_CONFIG, warnings: [{ key: 'theme.accent', kind: ConfigWarningKind.Invalid }] }
    config.setReading(warned)
    expect(config.read()).toBe(warned)
    expect(config.readCount).toBe(1 + 1)
  })
})

describe('LocaleSource fake', () => {
  it('reads the bundles it holds, null otherwise, and remembers each request', () => {
    const locales = createLocaleSourceFake([FRENCH])
    expect(locales.read(FRENCH.language)).toBe(FRENCH)
    expect(locales.read(ENGLISH.language)).toBeNull()
    locales.setBundle(ENGLISH.language, ENGLISH)
    locales.setBundle(FRENCH.language, null)
    expect([locales.read(ENGLISH.language), locales.read(FRENCH.language)]).toStrictEqual([ENGLISH, null])
    expect(locales.requested).toStrictEqual([FRENCH.language, ENGLISH.language, ENGLISH.language, FRENCH.language])
  })
})

describe('ConvarSource fake', () => {
  it('reads like the core source: null when absent, the raw text otherwise, read again on every use', () => {
    const convars = createConvarSourceFake({ [LOCALE_CONVAR]: FRENCH.language })
    expect(convars.read(LOCALE_CONVAR)).toBe(FRENCH.language)
    expect(readConvar(convars, PUSH_TO_TALK_CONVAR, ConvarBoolean, false).value).toBe(false)
    convars.set(PUSH_TO_TALK_CONVAR, String(true))
    expect(readConvar(convars, PUSH_TO_TALK_CONVAR, ConvarBoolean, false).value).toBe(true)
    convars.set(LOCALE_CONVAR, null)
    expect(convars.read(LOCALE_CONVAR)).toBeNull()
    expect(convars.requested).toStrictEqual([LOCALE_CONVAR, PUSH_TO_TALK_CONVAR, PUSH_TO_TALK_CONVAR, LOCALE_CONVAR])
  })
})
