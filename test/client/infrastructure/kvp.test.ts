import { createKvpFake, installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createGlyphStore, GLYPH_SET_KVP_KEY } from '../../../src/client/infrastructure/kvp'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'

let natives: NativeRecorder | null = null
const failures: unknown[][] = []

afterEach(() => {
  natives?.restore()
  natives = null
  failures.length = 0
})

const store = (): ReturnType<typeof createGlyphStore> => createGlyphStore((operation, cause) => failures.push([operation, cause]))

describe('createGlyphStore', () => {
  it('writes the glyph set with SetResourceKvp and reads it back with GetResourceKvpString', () => {
    const kvp = createKvpFake()
    natives = installNatives({ GetResourceKvpString: kvp.natives.GetResourceKvpString, SetResourceKvp: kvp.natives.SetResourceKvp })
    const glyphs = store()
    glyphs.write(GlyphSet.PlayStation)
    expect(natives.callsOf('SetResourceKvp')).toEqual([[GLYPH_SET_KVP_KEY, GlyphSet.PlayStation]])
    expect(glyphs.read()).toBe(GlyphSet.PlayStation)
  })

  it('answers null when nothing was stored', () => {
    const kvp = createKvpFake()
    natives = installNatives({ GetResourceKvpString: kvp.natives.GetResourceKvpString })
    expect(store().read()).toBeNull()
  })

  it.each([[''], ['gamecube'], ['XBOX']])('answers null for the stored value "%s", which is no glyph set', (stored) => {
    const kvp = createKvpFake()
    kvp.setString(GLYPH_SET_KVP_KEY, stored)
    natives = installNatives({ GetResourceKvpString: kvp.natives.GetResourceKvpString })
    expect(store().read()).toBeNull()
  })

  it('reports failing natives and lets nothing escape', () => {
    natives = installNatives({ GetResourceKvpString: () => { throw new Error('boom') }, SetResourceKvp: () => { throw new Error('boom') } })
    const glyphs = store()
    glyphs.write(GlyphSet.Xbox)
    expect(glyphs.read()).toBeNull()
    expect(failures.map(([operation]) => operation)).toEqual(['SetResourceKvp', 'GetResourceKvpString'])
  })
})
