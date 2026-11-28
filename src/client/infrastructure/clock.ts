import type { Clock } from '../../shared/ports'

export function createGameClock(): Clock {
  return { now: () => GetGameTimer() }
}
