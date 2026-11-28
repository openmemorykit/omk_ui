import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createClientConvars } from '../../../src/client/infrastructure/convars'

const TWO_READS = 2
let natives: NativeRecorder | null = null

afterEach(() => {
  natives?.restore()
  natives = null
})

describe('createClientConvars', () => {
  it('reads a convar with GetConvar every time, so a replicated change shows up', () => {
    const values = new Map<string, string>([['omk_ui_locale', 'fr']])
    natives = installNatives({ GetConvar: (name: string, fallback: string) => values.get(name) ?? fallback })
    const convars = createClientConvars()
    expect(convars.read('omk_ui_locale')).toBe('fr')
    values.set('omk_ui_locale', 'de')
    expect(convars.read('omk_ui_locale')).toBe('de')
    expect(natives.callsOf('GetConvar')).toHaveLength(TWO_READS)
  })

  it('answers null for a convar that is not set', () => {
    natives = installNatives({ GetConvar: (_name: string, fallback: string) => fallback })
    expect(createClientConvars().read('omk_ui_ptt')).toBeNull()
  })
})
