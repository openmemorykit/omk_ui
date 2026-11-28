import type { GlyphStore } from '../../../src/client/application/ports'
import type { GlyphSet } from '../../../src/protocol/page-vocabulary'

export interface GlyphStoreFake extends GlyphStore {
  readonly writes: readonly GlyphSet[]
}

export function createGlyphStoreFake(stored: GlyphSet | null = null): GlyphStoreFake {
  let current = stored
  const writes: GlyphSet[] = []
  return {
    read: () => current,
    write(set) {
      writes.push(set)
      current = set
    },
    writes,
  }
}
