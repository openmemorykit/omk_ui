import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createClientLocaleSource } from '../../../src/client/infrastructure/locales'
import { LocaleWarningKind, type LocaleWarning } from '../../../src/shared/locales/locale-warning'

const RESOURCE = 'omk_ui'
const ENGLISH = { 'ui.close': 'Close', 'ui.title': 'Panel {title}', 'keybind.radial': 'Open the radial', 'glyphs.usage': 'Usage', 'log.report.trace': 'Trace {details}' }

let natives: NativeRecorder | null = null
const warnings: LocaleWarning[] = []
const failures: unknown[][] = []

afterEach(() => {
  natives?.restore()
  natives = null
  warnings.length = 0
  failures.length = 0
})

function setUp(files: Readonly<Record<string, unknown>>, loadResourceFile?: (resource: string, path: string) => string | null): NativeRecorder {
  const load = loadResourceFile ?? ((_resource: string, path: string): string | null => {
    const content = Object.getOwnPropertyDescriptor(files, path)?.value as unknown
    return content === undefined ? null : JSON.stringify(content)
  })
  natives = installNatives({ GetCurrentResourceName: () => RESOURCE, LoadResourceFile: load })
  return natives
}

const source = (): ReturnType<typeof createClientLocaleSource> => createClientLocaleSource((warning) => warnings.push(warning), (operation, cause) => failures.push([operation, cause]))

describe('createClientLocaleSource', () => {
  it('reads the language files of its own resource with LoadResourceFile', () => {
    const recorder = setUp({ 'locales/en.json': ENGLISH, 'locales/de.json': { 'ui.close': 'Schliessen' } })
    source().read('de')
    expect(recorder.callsOf('LoadResourceFile')).toEqual([[RESOURCE, 'locales/en.json'], [RESOURCE, 'locales/de.json'], [RESOURCE, 'locales/overrides/de.json']])
  })

  it('falls back to English when the language is absent', () => {
    setUp({ 'locales/en.json': ENGLISH })
    expect(source().read('de')?.language).toBe('en')
    expect(warnings.map((warning) => warning.kind)).toEqual([LocaleWarningKind.LanguageUnavailable])
  })

  it('shows the English text for a key missing from an incomplete language', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/de.json': { 'ui.close': 'Schliessen' } })
    const bundle = source().read('de')
    expect(bundle?.messages['ui.close']).toBe('Schliessen')
    expect(bundle?.messages['ui.title']).toBe('Panel {title}')
  })

  it('applies the override of the language', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/overrides/en.json': { 'ui.close': 'Shut' } })
    expect(source().read('en')?.messages['ui.close']).toBe('Shut')
  })

  it('ignores and reports an unknown key of an override', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/overrides/en.json': { 'ui.nothing': 'x' } })
    source().read('en')
    expect(warnings).toEqual([{ kind: LocaleWarningKind.UnknownKey, file: 'locales/overrides/en.json', key: 'ui.nothing' }])
  })

  it('never renders a log.* key, and never reports one', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/overrides/en.json': { 'log.nothing': 'x' } })
    const bundle = source().read('en')
    expect(Object.keys(bundle?.messages ?? {}).filter((key) => key.startsWith('log.'))).toEqual([])
    expect(warnings).toEqual([])
  })

  it('renders the ui.*, glyphs.* and keybind.* keys', () => {
    setUp({ 'locales/en.json': ENGLISH })
    expect(Object.keys(source().read('en')?.messages ?? {}).sort()).toEqual(['glyphs.usage', 'keybind.radial', 'ui.close', 'ui.title'])
  })

  it('reads the files once for several reads of a language', () => {
    const recorder = setUp({ 'locales/en.json': ENGLISH })
    const locales = source()
    locales.read('en')
    const readsAfterFirst = recorder.callsOf('LoadResourceFile').length
    locales.read('en')
    expect(recorder.callsOf('LoadResourceFile').length).toBe(readsAfterFirst)
  })

  it('reports a failing LoadResourceFile and returns no bundle', () => {
    setUp({}, () => { throw new Error('boom') })
    expect(source().read('en')).toBeNull()
    expect(failures.map(([operation]) => operation)).toContain('LoadResourceFile locales/en.json')
  })

  it('treats a missing file as absent whatever the native returns', () => {
    setUp({}, () => undefined as unknown as string)
    expect(source().read('en')).toBeNull()
    expect(failures).toEqual([])
  })
})
