import { createFivemConvarSource } from '@openmemorykit/core/server'
import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'

const VERSION_CONVAR = 'version'
const LOCALE_CONVAR = 'omk_ui_locale'
const ARTIFACT = 'FXServer-master v1.0.0.38435 linux'

let recorder: NativeRecorder | null = null

function serverConvars(values: ReadonlyMap<string, string>): NativeRecorder {
  recorder = installNatives({ GetConvar: (name: string, fallback: string) => values.get(name) ?? fallback })
  return recorder
}

afterEach(() => {
  recorder?.restore()
  recorder = null
})

describe('server convars (core createFivemConvarSource, wired by the composition)', () => {
  it('reads version and omk_ui_locale through GetConvar, at each read', () => {
    const installed = serverConvars(new Map([[VERSION_CONVAR, ARTIFACT], [LOCALE_CONVAR, 'en']]))
    const convars = createFivemConvarSource()
    expect(convars.read(VERSION_CONVAR)).toBe(ARTIFACT)
    expect(convars.read(LOCALE_CONVAR)).toBe('en')
    expect(installed.callsOf('GetConvar').map(([name]) => name)).toStrictEqual([VERSION_CONVAR, LOCALE_CONVAR])
  })

  it('gives null for an absent or empty convar, so the application falls back to its default', () => {
    serverConvars(new Map([[LOCALE_CONVAR, '']]))
    const convars = createFivemConvarSource()
    expect(convars.read(VERSION_CONVAR)).toBeNull()
    expect(convars.read(LOCALE_CONVAR)).toBeNull()
  })
})
