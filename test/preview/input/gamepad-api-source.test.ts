import { describe, expect, it } from 'vitest'
import { Intent, IntentPhase, Modality } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { PageCommandType, type UiCommand } from '../../../src/page/domain/page-commands'
import type { PadContext } from '../../../src/client/domain/pad-snapshot'
import { createGamepadApiSource } from '../../../preview/input/gamepad-api-source'

const BUTTON_COUNT = 17
const SMALL_DRIFT = 0.1
const FULL_RIGHT = 0.8
const TINY_CHANGE = 0.805
const FULL_DOWN = 0.9
const SECOND = 2
const BUTTON = { A: 0, B: 1, Start: 9, DpadUp: 12 } as const

interface Rig {
  readonly commands: UiCommand[]
  readonly context: { value: PadContext }
  readonly pad: { buttons: Set<number>; axes: number[]; connected: boolean }
  readonly frames: (() => void)[]
  readonly nav: Navigator
  tick(): void
  attach(): () => void
}

function rig(): Rig {
  const commands: UiCommand[] = []
  const context = { value: { modality: Modality.Gamepad, radialOpen: false } as PadContext }
  const pad = { buttons: new Set<number>(), axes: [0, 0, 0, 0], connected: true }
  const frames: (() => void)[] = []
  const nav = {
    getGamepads: () => [
      null,
      {
        connected: pad.connected,
        axes: pad.axes,
        buttons: Array.from({ length: BUTTON_COUNT }, (_, index) => ({ pressed: pad.buttons.has(index), value: pad.buttons.has(index) ? 1 : 0 })),
      },
    ],
  } as unknown as Navigator
  const tick = (): void => {
    const run = frames.splice(0)
    run.forEach((frame) => frame())
  }
  return {
    commands, context, pad, frames, nav, tick,
    attach: () => createGamepadApiSource(nav, { request: (callback) => void frames.push(callback) }, (command) => void commands.push(command), () => context.value),
  }
}

const intent = (value: Intent, phase: IntentPhase): UiCommand => ({ type: PageCommandType.LocalIntent, intent: value, phase, fromEscape: false })

describe('gamepad api source', () => {
  it('turns button transitions into press and release phases', () => {
    const harness = rig()
    harness.attach()
    harness.tick()
    harness.pad.buttons.add(BUTTON.A)
    harness.tick()
    harness.tick()
    harness.pad.buttons.delete(BUTTON.A)
    harness.tick()
    expect(harness.commands).toEqual([intent(Intent.Confirm, IntentPhase.Press), intent(Intent.Confirm, IntentPhase.Release)])
  })

  it('maps the d-pad, B, start and select to their intents', () => {
    const harness = rig()
    harness.attach()
    harness.pad.buttons.add(BUTTON.DpadUp)
    harness.pad.buttons.add(BUTTON.B)
    harness.pad.buttons.add(BUTTON.Start)
    harness.tick()
    expect(harness.commands.map((command) => (command.type === PageCommandType.LocalIntent ? command.intent : null)).sort()).toEqual([Intent.Back, Intent.Submit, Intent.Up].sort())
  })

  it('uses the pad-snapshot dead zone for the stick while the radial is open', () => {
    const harness = rig()
    harness.context.value = { modality: Modality.Gamepad, radialOpen: true }
    harness.attach()
    harness.pad.axes = [SMALL_DRIFT, SMALL_DRIFT, 0, 0]
    harness.tick()
    expect(harness.commands).toEqual([])
    harness.pad.axes = [FULL_RIGHT, 0, 0, 0]
    harness.tick()
    expect(harness.commands).toEqual([{ type: ToPage.Stick, x: FULL_RIGHT, y: 0 }])
  })

  it('sends the vector only when it changed, at most once per frame', () => {
    const harness = rig()
    harness.context.value = { modality: Modality.Gamepad, radialOpen: true }
    harness.attach()
    harness.pad.axes = [FULL_RIGHT, 0, 0, 0]
    harness.tick()
    harness.tick()
    harness.pad.axes = [TINY_CHANGE, 0, 0, 0]
    harness.tick()
    expect(harness.commands).toHaveLength(1)
    harness.pad.axes = [0, FULL_DOWN, 0, 0]
    harness.tick()
    expect(harness.commands).toHaveLength(SECOND)
    expect(harness.commands[SECOND - 1]).toEqual({ type: ToPage.Stick, x: 0, y: FULL_DOWN })
  })

  it('sends nothing outside the gamepad modality', () => {
    const harness = rig()
    harness.context.value = { modality: Modality.KeyboardMouse, radialOpen: false }
    harness.attach()
    harness.pad.buttons.add(BUTTON.A)
    harness.tick()
    expect(harness.commands).toEqual([])
  })

  it('makes one frame request per frame while attached', () => {
    const harness = rig()
    harness.attach()
    expect(harness.frames).toHaveLength(1)
    harness.tick()
    expect(harness.frames).toHaveLength(1)
  })

  it('stops polling after detach', () => {
    const harness = rig()
    const detach = harness.attach()
    detach()
    harness.pad.buttons.add(BUTTON.A)
    harness.tick()
    expect(harness.commands).toEqual([])
    expect(harness.frames).toHaveLength(0)
  })

  it('survives a missing, disconnected or throwing gamepad list', () => {
    const harness = rig()
    harness.pad.connected = false
    harness.attach()
    harness.pad.buttons.add(BUTTON.A)
    harness.tick()
    expect(harness.commands).toEqual([])
    const broken = { getGamepads: () => { throw new Error('denied') } } as unknown as Navigator
    const frames: (() => void)[] = []
    createGamepadApiSource(broken, { request: (callback) => void frames.push(callback) }, () => undefined, () => harness.context.value)
    expect(() => frames.splice(0).forEach((frame) => frame())).not.toThrow()
    expect(frames).toHaveLength(1)
  })
})
