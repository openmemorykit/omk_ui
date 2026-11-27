import type { RandomSource } from '../../../src/client/application/ports'

export const MIDDLE_DRAW = 0.5

export interface RandomFake extends RandomSource {
  readonly drawCount: number
}

export function createRandomFake(draws: readonly number[] = [MIDDLE_DRAW]): RandomFake {
  if (draws.length === 0) throw new RangeError('A random fake needs at least one draw')
  let drawCount = 0
  return {
    next() {
      const draw = draws[drawCount % draws.length] ?? MIDDLE_DRAW
      drawCount += 1
      return draw
    },
    get drawCount() {
      return drawCount
    },
  }
}
