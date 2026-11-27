import type { LocalEvents } from '../../../src/client/application/ports'

export interface LocalEventsFake extends LocalEvents {
  readonly readyCount: number
}

export function createLocalEventsFake(): LocalEventsFake {
  let readyCount = 0
  return {
    emitReady() {
      readyCount += 1
    },
    get readyCount() {
      return readyCount
    },
  }
}
