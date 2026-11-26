import type { ValueOf } from '@openmemorykit/core/shared'
import { InputSource, Intent, IntentPhase, Modality } from '../../protocol/intents'
import type { IntentEvent, StickEvent } from '../../protocol/intents'

export const PadControl = {
  NextCamera: 0,
  FrontendDown: 187,
  FrontendUp: 188,
  FrontendLeft: 189,
  FrontendRight: 190,
  FrontendAxisX: 195,
  FrontendAxisY: 196,
  FrontendPause: 199,
  FrontendAccept: 201,
  FrontendCancel: 202,
  FrontendX: 203,
  FrontendY: 204,
  FrontendLb: 205,
  FrontendRb: 206,
} as const
export type PadControl = ValueOf<typeof PadControl>

export const PAD_INTENTS: readonly (readonly [PadControl, Intent])[] = [
  [PadControl.FrontendUp, Intent.Up],
  [PadControl.FrontendDown, Intent.Down],
  [PadControl.FrontendLeft, Intent.Left],
  [PadControl.FrontendRight, Intent.Right],
  [PadControl.FrontendAccept, Intent.Confirm],
  [PadControl.FrontendCancel, Intent.Back],
  [PadControl.FrontendLb, Intent.TabPrev],
  [PadControl.FrontendRb, Intent.TabNext],
  [PadControl.FrontendX, Intent.Erase],
  [PadControl.FrontendY, Intent.Space],
  [PadControl.FrontendPause, Intent.Submit],
  [PadControl.NextCamera, Intent.Radial],
]

export const STICK_DEADZONE = 0.2
export const STICK_CHANGE_THRESHOLD = 0.02
export const STICK_AS_DPAD_PRESS = 0.6
export const STICK_AS_DPAD_RELEASE = 0.4

const STICK_LIMIT = 1
const NEUTRAL_STICK: StickEvent = Object.freeze({ x: 0, y: 0 })
const BUTTON_CONTROLS: ReadonlySet<PadControl> = new Set(PAD_INTENTS.map(([control]) => control))

export interface PadReading {
  readonly held: ReadonlySet<PadControl>
  readonly stick: StickEvent
}

export interface PadSnapshotState {
  readonly held: ReadonlySet<PadControl>
  readonly lastSentStick: StickEvent
  readonly stickDirections: ReadonlySet<Intent>
}

export interface PadContext {
  readonly modality: Modality
  readonly radialOpen: boolean
}

export interface PadComparison {
  readonly state: PadSnapshotState
  readonly intents: readonly IntentEvent[]
  readonly stick: StickEvent | null
}

function clampAxis(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(-STICK_LIMIT, Math.min(STICK_LIMIT, value)) + 0
}

function sanitizeStick(stick: StickEvent): StickEvent {
  return { x: clampAxis(stick.x), y: clampAxis(stick.y) }
}

function readHeld(held: ReadonlySet<PadControl>): ReadonlySet<PadControl> {
  return new Set([...held].filter((control) => BUTTON_CONTROLS.has(control)))
}

function axisActive(magnitude: number, wasActive: boolean): boolean {
  return magnitude >= (wasActive ? STICK_AS_DPAD_RELEASE : STICK_AS_DPAD_PRESS)
}

function stickCross(stick: StickEvent, previous: ReadonlySet<Intent>): ReadonlySet<Intent> {
  const horizontal = stick.x < 0 ? Intent.Left : Intent.Right
  const vertical = stick.y < 0 ? Intent.Up : Intent.Down
  const horizontalActive = axisActive(Math.abs(stick.x), previous.has(horizontal))
  const verticalActive = axisActive(Math.abs(stick.y), previous.has(vertical))
  const horizontalWins = Math.abs(stick.x) > Math.abs(stick.y)
  const directions: Intent[] = []
  if (horizontalActive && (horizontalWins || !verticalActive)) directions.push(horizontal)
  if (verticalActive && (!horizontalWins || !horizontalActive)) directions.push(vertical)
  return new Set(directions)
}

function outsideDeadzone(stick: StickEvent): boolean {
  return Math.hypot(stick.x, stick.y) >= STICK_DEADZONE
}

function aimVector(stick: StickEvent): StickEvent {
  return outsideDeadzone(stick) ? stick : NEUTRAL_STICK
}

function vectorChanged(next: StickEvent, last: StickEvent): boolean {
  return Math.abs(next.x - last.x) > STICK_CHANGE_THRESHOLD || Math.abs(next.y - last.y) > STICK_CHANGE_THRESHOLD
}

function transitions(
  previous: ReadonlySet<Intent>,
  next: ReadonlySet<Intent>,
  order: readonly Intent[],
): readonly IntentEvent[] {
  return order.flatMap((intent) => {
    if (previous.has(intent) === next.has(intent)) return []
    return [{ intent, phase: next.has(intent) ? IntentPhase.Press : IntentPhase.Release, source: InputSource.Pad }]
  })
}

function buttonTransitions(previous: ReadonlySet<PadControl>, next: ReadonlySet<PadControl>): readonly IntentEvent[] {
  return PAD_INTENTS.flatMap(([control, intent]) => {
    if (previous.has(control) === next.has(control)) return []
    return [{ intent, phase: next.has(control) ? IntentPhase.Press : IntentPhase.Release, source: InputSource.Pad }]
  })
}

const STICK_INTENT_ORDER: readonly Intent[] = [Intent.Up, Intent.Down, Intent.Left, Intent.Right]

export function primePadSnapshot(reading: PadReading): PadSnapshotState {
  return {
    held: readHeld(reading.held),
    lastSentStick: NEUTRAL_STICK,
    stickDirections: stickCross(sanitizeStick(reading.stick), new Set()),
  }
}

export function comparePadSnapshot(state: PadSnapshotState, reading: PadReading, context: PadContext): PadComparison {
  if (context.modality !== Modality.Gamepad) return { state: primePadSnapshot(reading), intents: [], stick: null }
  const stick = sanitizeStick(reading.stick)
  const held = readHeld(reading.held)
  const buttons = buttonTransitions(state.held, held)
  if (!context.radialOpen) {
    const stickDirections = stickCross(stick, state.stickDirections)
    return {
      state: { held, lastSentStick: NEUTRAL_STICK, stickDirections },
      intents: [...buttons, ...transitions(state.stickDirections, stickDirections, STICK_INTENT_ORDER)],
      stick: null,
    }
  }
  const aim = aimVector(stick)
  const sent = vectorChanged(aim, state.lastSentStick)
  return {
    state: { held, lastSentStick: sent ? aim : state.lastSentStick, stickDirections: new Set() },
    intents: [...buttons, ...transitions(state.stickDirections, new Set(), STICK_INTENT_ORDER)],
    stick: sent ? aim : null,
  }
}
