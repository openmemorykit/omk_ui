import { createFrameLoop } from '@openmemorykit/core/client'
import type { LoopPort } from '../application/ports'

export const FrameLoopName = { Pump: 'pump', Idle: 'idle' } as const
export type FrameLoopName = (typeof FrameLoopName)[keyof typeof FrameLoopName]

export interface FrameLoopsOptions {
  readonly onPumpFrame: () => void
  readonly onIdleFrame: () => void
  readonly onFailure: (loop: FrameLoopName, error: unknown) => void
}

export interface FrameLoops {
  readonly pump: LoopPort
  readonly idle: LoopPort
}

export function createFrameLoops(options: FrameLoopsOptions): FrameLoops {
  return {
    pump: createFrameLoop(options.onPumpFrame, (error) => options.onFailure(FrameLoopName.Pump, error)),
    idle: createFrameLoop(options.onIdleFrame, (error) => options.onFailure(FrameLoopName.Idle, error)),
  }
}
