import { GlyphSet } from '../../protocol/page-vocabulary'
import type { GlyphStore } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

export const GLYPH_SET_KVP_KEY = 'omk_ui:glyphSet'

function glyphSetOf(stored: string | null): GlyphSet | null {
  return Object.values(GlyphSet).find((glyphSet) => glyphSet === stored) ?? null
}

export function createGlyphStore(onFailure: NativeFailureHandler): GlyphStore {
  return {
    read: () => glyphSetOf(guardedNativeCall(onFailure, 'GetResourceKvpString', () => GetResourceKvpString(GLYPH_SET_KVP_KEY), null)),
    write: (set) => {
      guardedNativeCall(onFailure, 'SetResourceKvp', () => SetResourceKvp(GLYPH_SET_KVP_KEY, set), undefined)
    },
  }
}
