import { describe, expect, it } from 'vitest'
import english from '../../../omk_ui/locales/en.json'
import french from '../../../omk_ui/locales/fr.json'
import { OmkSubcommand } from '../../../src/server/application/omk-subcommand'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { ConfigWarningKind } from '../../../src/shared/config/read-config'
import { LocaleWarningKind } from '../../../src/shared/locales/locale-warning'
import { ReportKind } from '../../../src/shared/report/report-kind'

const frMessages: Readonly<Record<string, string>> = french
const enMessages: Readonly<Record<string, string>> = english
const DETAILS = '{details}'
const KEYBINDS = ['keybind.radial', 'keybind.interact']
const GLYPH_COMMAND = ['glyphs.suggestion', 'glyphs.usage', 'glyphs.changed']
const DEBUG_LINES = ['header', 'state', 'stack', 'form', 'radial', 'prompt', 'bindings', 'intents', 'noReply'].map((line) => `log.debug.${line}`)
const NAME_REFUSAL = 'log.wrongResourceName'
const COMMAND_DENIED = 'log.command.denied'
const FILE_PARAMETER = '{file}'
const KEY_PARAMETER = '{key}'
const LOCALE_WARNINGS_WITH_KEY: readonly LocaleWarningKind[] = [LocaleWarningKind.UnknownKey, LocaleWarningKind.NotText, LocaleWarningKind.ParameterMismatch]

const keysUnder = (prefix: string, values: Readonly<Record<string, string>>): string[] => Object.values(values).map((value) => `${prefix}.${value}`)
const scriptKeys = (messages: Readonly<Record<string, string>>): string[] => Object.keys(messages).filter((key) => !key.startsWith('ui.')).sort()

describe('locale keys of the client and server scripts', () => {
  it('are the same in fr and en', () => {
    expect(scriptKeys(enMessages)).toStrictEqual(scriptKeys(frMessages))
  })

  it.each([
    ['ReportKind', keysUnder('log.report', ReportKind)],
    ['OmkSubcommand confirmations', keysUnder('log.command', OmkSubcommand)],
    ['OmkSubcommand usages', keysUnder('log.usage', OmkSubcommand)],
    ['ConfigWarningKind', keysUnder('log.config.warning', ConfigWarningKind)],
    ['GlyphSet', keysUnder('glyphs.set', GlyphSet)],
    ['key bindings', KEYBINDS],
    ['omk_glyphs command', GLYPH_COMMAND],
    ['debug lines of 7.4', DEBUG_LINES],
    ['name refusal', [NAME_REFUSAL]],
    ['denied command', [COMMAND_DENIED]],
    ['LocaleWarningKind', keysUnder('log.locale', LocaleWarningKind)],
  ])('have a key for every %s member', (_name, keys) => {
    keys.forEach((key) => {
      expect(frMessages[key], key).toBeTypeOf('string')
      expect(enMessages[key], key).toBeTypeOf('string')
    })
  })

  it('give every report line the details of the report', () => {
    keysUnder('log.report', ReportKind).forEach((key) => {
      expect(frMessages[key], key).toContain(DETAILS)
      expect(enMessages[key], key).toContain(DETAILS)
    })
  })

  it('give every locale warning the file, and the key when the warning is about a key', () => {
    Object.values(LocaleWarningKind).forEach((kind) => {
      const key = `log.locale.${kind}`
      const parameters = LOCALE_WARNINGS_WITH_KEY.includes(kind) ? [FILE_PARAMETER, KEY_PARAMETER] : [FILE_PARAMETER]
      parameters.forEach((parameter) => {
        expect(frMessages[key], key).toContain(parameter)
        expect(enMessages[key], key).toContain(parameter)
      })
      if (!LOCALE_WARNINGS_WITH_KEY.includes(kind)) {
        expect(frMessages[key], key).not.toContain(KEY_PARAMETER)
        expect(enMessages[key], key).not.toContain(KEY_PARAMETER)
      }
    })
  })
})
