import { ToPage } from '../../src/protocol/to-page'
import { comparePadSnapshot, PadControl, primePadSnapshot, type PadContext, type PadReading, type PadSnapshotState } from '../../src/client/domain/pad-snapshot'
import type { Dispatch, FrameRequester } from '../../src/page/application/ports'
import { PageCommandType } from '../../src/page/domain/page-commands'
import type { Detach } from '../../src/page/infrastructure/window-events'

const StandardButton = { A: 0, B: 1, X: 2, Y: 3, Lb: 4, Rb: 5, Select: 8, Start: 9, DpadUp: 12, DpadDown: 13, DpadLeft: 14, DpadRight: 15 } as const

const BUTTON_CONTROLS: ReadonlyMap<number, PadControl> = new Map([
  [StandardButton.A, PadControl.FrontendAccept],
  [StandardButton.B, PadControl.FrontendCancel],
  [StandardButton.X, PadControl.FrontendX],
  [StandardButton.Y, PadControl.FrontendY],
  [StandardButton.Lb, PadControl.FrontendLb],
  [StandardButton.Rb, PadControl.FrontendRb],
  [StandardButton.Select, PadControl.NextCamera],
  [StandardButton.Start, PadControl.FrontendPause],
  [StandardButton.DpadUp, PadControl.FrontendUp],
  [StandardButton.DpadDown, PadControl.FrontendDown],
  [StandardButton.DpadLeft, PadControl.FrontendLeft],
  [StandardButton.DpadRight, PadControl.FrontendRight],
])

const STICK_X_AXIS = 0
const STICK_Y_AXIS = 1
const EMPTY_READING: PadReading = { held: new Set(), stick: { x: 0, y: 0 } }

function readPad(nav: Navigator): PadReading {
  try {
    const pad = [...nav.getGamepads()].find((candidate) => candidate?.connected === true)
    if (pad === null || pad === undefined) return EMPTY_READING
    const held = new Set<PadControl>()
    for (const [index, control] of BUTTON_CONTROLS) if (pad.buttons[index]?.pressed === true) held.add(control)
    return { held, stick: { x: pad.axes[STICK_X_AXIS] ?? 0, y: pad.axes[STICK_Y_AXIS] ?? 0 } }
  } catch {
    return EMPTY_READING
  }
}

export function createGamepadApiSource(nav: Navigator, frames: FrameRequester, dispatch: Dispatch, context: () => PadContext): Detach {
  let attached = true
  let snapshot: PadSnapshotState = primePadSnapshot(EMPTY_READING)

  function poll(): void {
    if (!attached) return
    try {
      const comparison = comparePadSnapshot(snapshot, readPad(nav), context())
      snapshot = comparison.state
      for (const event of comparison.intents) {
        dispatch({ type: PageCommandType.LocalIntent, intent: event.intent, phase: event.phase, fromEscape: false })
      }
      if (comparison.stick !== null) dispatch({ type: ToPage.Stick, x: comparison.stick.x, y: comparison.stick.y })
    } catch {
      snapshot = primePadSnapshot(EMPTY_READING)
    }
    frames.request(poll)
  }

  frames.request(poll)
  return () => {
    attached = false
  }
}

