import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export const TimerOperation = { Arm: 'arm timer', Elapsed: 'timer elapsed' } as const

export function armTimer(delayMs: number, onElapsed: () => void, onFailure: FailureHandler): void {
  guardedCall(onFailure, TimerOperation.Arm, () => setTimeout(() => guardedCall(onFailure, TimerOperation.Elapsed, onElapsed, undefined), delayMs), undefined)
}
