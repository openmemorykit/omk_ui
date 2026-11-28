import { GlyphSet } from '../../protocol/page-vocabulary'
import type { GlyphStore } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export const GLYPH_SET_KVP_KEY = 'omk_ui:glyphSet'

function glyphSetOf(stored: string | null): GlyphSet | null {
  return Object.values(GlyphSet).find((glyphSet) => glyphSet === stored) ?? null
}

export function createGlyphStore(onFailure: FailureHandler): GlyphStore {
  return {
    read: () => glyphSetOf(guardedCall(onFailure, 'GetResourceKvpString', () => GetResourceKvpString(GLYPH_SET_KVP_KEY), null)),
    write: (set) => {
      guardedCall(onFailure, 'SetResourceKvp', () => SetResourceKvp(GLYPH_SET_KVP_KEY, set), undefined)
    },
  }
}
