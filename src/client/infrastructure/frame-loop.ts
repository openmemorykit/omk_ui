import { createFrameLoop } from '@openmemorykit/core/client'
import type { FailureHandler } from '../../shared/guarded-call'
import type { LoopPort } from '../application/ports'

export const FrameLoopOperation = { Pump: 'frame loop pump', Idle: 'frame loop idle' } as const

export interface FrameLoopsOptions {
  readonly onPumpFrame: () => void
  readonly onIdleFrame: () => void
  readonly onFailure: FailureHandler
}

export interface FrameLoops {
  readonly pump: LoopPort
  readonly idle: LoopPort
}

export function createFrameLoops(options: FrameLoopsOptions): FrameLoops {
  return {
    pump: createFrameLoop(options.onPumpFrame, (error) => options.onFailure(FrameLoopOperation.Pump, error)),
    idle: createFrameLoop(options.onIdleFrame, (error) => options.onFailure(FrameLoopOperation.Idle, error)),
  }
}
