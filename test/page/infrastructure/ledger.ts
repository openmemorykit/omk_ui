import { vi } from 'vitest'

export interface ListenerLedger {
  active(): number
  restore(): void
}

type Registration = readonly [string, unknown]

function remaining(added: readonly Registration[], removed: readonly Registration[]): number {
  const left = [...added]
  for (const [type, listener] of removed) {
    const index = left.findIndex(([addedType, addedListener]) => addedType === type && addedListener === listener)
    if (index >= 0) left.splice(index, 1)
  }
  return left.length
}

export function trackListeners(target: EventTarget): ListenerLedger {
  const add = vi.spyOn(target, 'addEventListener')
  const remove = vi.spyOn(target, 'removeEventListener')
  return {
    active: () => remaining(add.mock.calls.map(([type, listener]) => [type, listener]), remove.mock.calls.map(([type, listener]) => [type, listener])),
    restore: () => {
      add.mockRestore()
      remove.mockRestore()
    },
  }
}
