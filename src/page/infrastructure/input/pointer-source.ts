import { Intent, IntentPhase } from '../../../protocol/intents'
import { BOUND_KEY_CODES, BindingKind, decodeBinding } from '../../domain/key-map'
import { PageCommandType } from '../../domain/page-commands'
import type { Dispatch } from '../../application/ports'
import type { Detach } from '../window-events'

export interface PointerSourceState {
  readonly radialBinding: string
  readonly radialOpen: boolean
}

export const WHEEL_NOTCH_PX = 40
export const WHEEL_PAGE_PX = 400
export const MAX_WHEEL_STEPS_PER_EVENT = 10

const MIDDLE_CONTROL = 102
const MouseButton = { Primary: 0, Middle: 1 } as const
const WheelMode = { Pixel: 0, Line: 1, Page: 2 } as const

function wheelPixels(event: WheelEvent): number {
  if (event.deltaMode === WheelMode.Line) return event.deltaY * WHEEL_NOTCH_PX
  return event.deltaMode === WheelMode.Page ? event.deltaY * WHEEL_PAGE_PX : event.deltaY
}

function middleOpensRadial(binding: string): boolean {
  const decoded = decodeBinding(binding)
  return decoded.kind === BindingKind.Known && decoded.code === BOUND_KEY_CODES[MIDDLE_CONTROL]
}

function createTap(dispatch: Dispatch): (intent: Intent) => void {
  return (intent) => {
    dispatch({ type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Press, fromEscape: false })
    dispatch({ type: PageCommandType.LocalIntent, intent, phase: IntentPhase.Release, fromEscape: false })
  }
}

function createWheelHandler(tap: (intent: Intent) => void): (event: WheelEvent) => void {
  let accumulated = 0
  return (event) => {
    const delta = wheelPixels(event)
    if (!Number.isFinite(delta)) return
    accumulated = Math.sign(accumulated) === -Math.sign(delta) ? delta : accumulated + delta
    const total = Math.abs(accumulated)
    const notches = Math.floor(total / WHEEL_NOTCH_PX)
    const steps = Math.min(notches, MAX_WHEEL_STEPS_PER_EVENT)
    const direction = accumulated < 0 ? Intent.Up : Intent.Down
    accumulated = steps === notches ? Math.sign(accumulated) * (total - notches * WHEEL_NOTCH_PX) : 0
    for (let step = 0; step < steps; step += 1) tap(direction)
  }
}

export function createPointerSource(target: Window, dispatch: Dispatch, read: () => PointerSourceState): Detach {
  const tap = createTap(dispatch)
  const onWheel = createWheelHandler(tap)
  const onMouseMove = (): void => dispatch({ type: PageCommandType.LocalModality })

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault()
    tap(Intent.Back)
  }

  function onMouseDown(event: MouseEvent): void {
    const state = read()
    if (event.button === MouseButton.Middle && middleOpensRadial(state.radialBinding)) {
      event.preventDefault()
      tap(Intent.Radial)
    } else if (event.button === MouseButton.Primary && state.radialOpen) {
      tap(Intent.Confirm)
    } else {
      onMouseMove()
    }
  }

  target.addEventListener('wheel', onWheel)
  target.addEventListener('contextmenu', onContextMenu)
  target.addEventListener('mousedown', onMouseDown)
  target.addEventListener('mousemove', onMouseMove)
  return () => {
    target.removeEventListener('wheel', onWheel)
    target.removeEventListener('contextmenu', onContextMenu)
    target.removeEventListener('mousedown', onMouseDown)
    target.removeEventListener('mousemove', onMouseMove)
  }
}
