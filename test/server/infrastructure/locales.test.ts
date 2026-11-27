import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createServerLocaleSource } from '../../../src/server/infrastructure/locales'
import { LocaleWarningKind, type LocaleWarning } from '../../../src/shared/locales/locale-warning'

const RESOURCE = 'omk_ui'
const ENGLISH = { 'ui.close': 'Close', 'log.line.server': '{time} server', 'log.command.version': 'Version {kit}' }

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

const source = (): ReturnType<typeof createServerLocaleSource> => createServerLocaleSource((warning) => warnings.push(warning), (operation, cause) => failures.push([operation, cause]))

describe('createServerLocaleSource', () => {
  it('renders every key, the log.* keys included', () => {
    setUp({ 'locales/en.json': ENGLISH })
    expect(Object.keys(source().read('en')?.messages ?? {}).sort()).toEqual(['log.command.version', 'log.line.server', 'ui.close'])
  })

  it('reads the files of its own resource with LoadResourceFile', () => {
    const recorder = setUp({ 'locales/en.json': ENGLISH, 'locales/fr.json': {} })
    source().read('fr')
    expect(recorder.callsOf('LoadResourceFile')).toEqual([[RESOURCE, 'locales/en.json'], [RESOURCE, 'locales/fr.json'], [RESOURCE, 'locales/overrides/fr.json']])
  })

  it('falls back to English for an absent language and an incomplete one', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/fr.json': { 'ui.close': 'Fermer' } })
    const locales = source()
    expect(locales.read('de')?.language).toBe('en')
    expect(locales.read('fr')?.messages['log.line.server']).toBe('{time} server')
  })

  it('applies the override and reports an unknown key of it', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/overrides/en.json': { 'log.command.version': 'v {kit}', 'log.nothing': 'x' } })
    expect(source().read('en')?.messages['log.command.version']).toBe('v {kit}')
    expect(warnings).toEqual([{ kind: LocaleWarningKind.UnknownKey, file: 'locales/overrides/en.json', key: 'log.nothing' }])
  })

  it('refuses an override whose parameters differ and reports it', () => {
    setUp({ 'locales/en.json': ENGLISH, 'locales/overrides/en.json': { 'log.command.version': 'v {number}' } })
    expect(source().read('en')?.messages['log.command.version']).toBe('Version {kit}')
    expect(warnings.map((warning) => warning.kind)).toEqual([LocaleWarningKind.ParameterMismatch])
  })

  it('reports a failing LoadResourceFile and returns no bundle', () => {
    setUp({}, () => { throw new Error('boom') })
    expect(source().read('en')).toBeNull()
    expect(failures.map(([operation]) => operation)).toContain('LoadResourceFile locales/en.json')
  })

  it('treats a missing file as absent whatever the native returns', () => {
    setUp({}, () => undefined as unknown as string)
    expect(source().read('en')).toBeNull()
  })
})
