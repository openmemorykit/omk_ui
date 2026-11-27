import type { RandomSource } from '../application/ports'

export function createRandomSource(): RandomSource {
  return { next: () => Math.random() }
}
