import type { Clock } from '../../shared/ports'

export function createServerClock(): Clock {
  return { now: () => GetGameTimer() }
}
