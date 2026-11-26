import { Modality } from '../../protocol/intents'

export const GesturePhase = { Idle: 'idle', Pressed: 'pressed', Held: 'held' } as const
export type GesturePhase = (typeof GesturePhase)[keyof typeof GesturePhase]

export type GestureState =
  | { readonly phase: typeof GesturePhase.Idle }
  | { readonly phase: typeof GesturePhase.Pressed; readonly startedAt: number }
  | { readonly phase: typeof GesturePhase.Held; readonly modality: Modality }

export const GestureSignal = { Press: 'press', Release: 'release', Frame: 'frame', ModeChanged: 'modeChanged' } as const
export type GestureSignal = (typeof GestureSignal)[keyof typeof GestureSignal]

export type GestureInput =
  | { readonly signal: typeof GestureSignal.Press; readonly modality: Modality; readonly at: number }
  | { readonly signal: typeof GestureSignal.Release; readonly at: number }
  | { readonly signal: typeof GestureSignal.Frame; readonly at: number }
  | { readonly signal: typeof GestureSignal.ModeChanged }

export const GestureDecision = { Open: 'open', CycleCamera: 'cycleCamera', Ignore: 'ignore' } as const
export type GestureDecision = (typeof GestureDecision)[keyof typeof GestureDecision]

export interface GestureSettings { readonly holdMs: number; readonly padHoldGesture: boolean }
export interface GestureStep { readonly state: GestureState; readonly decision: GestureDecision; readonly blockCameraControl: boolean }

export const IDLE_GESTURE: GestureState = Object.freeze({ phase: GesturePhase.Idle })

function step(state: GestureState, decision: GestureDecision, blockCameraControl: boolean): GestureStep {
  return { state, decision, blockCameraControl }
}

function stepIdle(input: GestureInput, settings: GestureSettings): GestureStep {
  if (input.signal !== GestureSignal.Press) return step(IDLE_GESTURE, GestureDecision.Ignore, false)
  if (input.modality === Modality.KeyboardMouse) {
    return step({ phase: GesturePhase.Held, modality: input.modality }, GestureDecision.Open, false)
  }
  if (!settings.padHoldGesture) return step(IDLE_GESTURE, GestureDecision.Ignore, false)
  return step({ phase: GesturePhase.Pressed, startedAt: input.at }, GestureDecision.Ignore, true)
}

function stepPressed(state: Extract<GestureState, { phase: typeof GesturePhase.Pressed }>, input: GestureInput, settings: GestureSettings): GestureStep {
  if (input.signal === GestureSignal.ModeChanged) return step(IDLE_GESTURE, GestureDecision.Ignore, false)
  if (input.signal === GestureSignal.Press) return step(state, GestureDecision.Ignore, true)
  const heldLongEnough = input.at - state.startedAt >= settings.holdMs
  if (input.signal === GestureSignal.Frame) {
    if (!heldLongEnough) return step(state, GestureDecision.Ignore, true)
    return step({ phase: GesturePhase.Held, modality: Modality.Gamepad }, GestureDecision.Open, true)
  }
  return step(IDLE_GESTURE, heldLongEnough ? GestureDecision.Open : GestureDecision.CycleCamera, true)
}

function stepHeld(state: Extract<GestureState, { phase: typeof GesturePhase.Held }>, input: GestureInput): GestureStep {
  const block = state.modality === Modality.Gamepad
  if (input.signal === GestureSignal.ModeChanged) return step(IDLE_GESTURE, GestureDecision.Ignore, false)
  if (input.signal === GestureSignal.Release) return step(IDLE_GESTURE, GestureDecision.Ignore, block)
  return step(state, GestureDecision.Ignore, block)
}

export function stepGesture(state: GestureState, input: GestureInput, settings: GestureSettings): GestureStep {
  if (input.signal === GestureSignal.ModeChanged) return step(IDLE_GESTURE, GestureDecision.Ignore, false)
  switch (state.phase) {
    case GesturePhase.Idle:
      return stepIdle(input, settings)
    case GesturePhase.Pressed:
      return stepPressed(state, input, settings)
    case GesturePhase.Held:
      return stepHeld(state, input)
  }
}
