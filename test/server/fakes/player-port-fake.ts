import type { PlayerPort } from '../../../src/server/application/ports'

export interface PlayerPortFake extends PlayerPort {
  join(source: number): void
  drop(source: number): void
}

export function createPlayerPortFake(initial: readonly number[] = []): PlayerPortFake {
  const connected = new Set<number>(initial)
  return {
    exists: (source) => connected.has(source),
    list: () => [...connected],
    join(source) {
      connected.add(source)
    },
    drop(source) {
      connected.delete(source)
    },
  }
}
