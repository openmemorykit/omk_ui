import type { ConvarSource } from '@openmemorykit/core/shared'

export interface ConvarSourceFake extends ConvarSource {
  readonly requested: readonly string[]
  set(name: string, value: string | null): void
}

export function createConvarSourceFake(values: Readonly<Record<string, string>> = {}): ConvarSourceFake {
  const byName = new Map<string, string>(Object.entries(values))
  const requested: string[] = []
  return {
    read(name) {
      requested.push(name)
      return byName.get(name) ?? null
    },
    set(name, value) {
      if (value === null) byName.delete(name)
      else byName.set(name, value)
    },
    requested,
  }
}
