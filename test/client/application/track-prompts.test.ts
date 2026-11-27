import { PROMPT_HOLD_DEFAULT_MS, ReplyKind, type Prompt } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it } from 'vitest'
import { pumpFrame } from '../../../src/client/application/pump-inputs'
import { INTERACT_CONTROL, interactPress, interactRelease } from '../../../src/client/application/track-prompts'
import { PromptPhase } from '../../../src/client/domain/hold-prompt'
import { EMPTY_REGISTRY } from '../../../src/client/domain/owner-registry'
import { Modality } from '../../../src/protocol/intents'
import { PromptState, UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { INPUT_DEFAULTS } from '../../../src/shared/config/config-schema'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner } from '../../fixtures/owned'
import { HOLD_PROMPT, HOLD_PROMPT_MS, PRESS_PROMPT } from '../../fixtures/surfaces'
import { expectKeepInputNeverTurnedOn, linesOf, registryWithPrompt, storeWith, watchedPorts } from './watched-ports'

const NOW = 3000
const HOLD_ID = 'garage/open-door'
const OTHER_OWNER = 'bank'

afterEach(expectKeepInputNeverTurnedOn)

function promptStore(prompt: Prompt = HOLD_PROMPT, modality: Modality = Modality.KeyboardMouse): ReturnType<typeof storeWith> {
  return storeWith({ registry: registryWithPrompt(prompt), modality })
}

function progress(state: PromptState, holdMs = HOLD_PROMPT_MS): unknown {
  return { type: ToPage.PromptProgress, promptId: HOLD_ID, state, holdMs }
}

describe('interact command on a hold prompt', () => {
  it('starts the hold and tells the page once, with the hold duration', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    expect(ports.nui.sent).toStrictEqual([progress(PromptState.Holding)])
    expect(linesOf(store, ReportKind.PromptChanged).map((line) => line.data)).toStrictEqual([{ owner: FixtureOwner.Garage, promptId: HOLD_ID, state: PromptState.Holding }])
  })

  it('completes on time from the pump, answers the owner and gets ready for the next hold', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    ports.clock.advance(HOLD_PROMPT_MS - 1)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sent).toHaveLength(1)
    ports.clock.advance(1)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sent).toStrictEqual([progress(PromptState.Holding), progress(PromptState.Completed)])
    expect(ports.replies.delivered).toStrictEqual([{ owner: FixtureOwner.Garage, reply: { kind: ReplyKind.PromptCompleted, promptId: HOLD_PROMPT.id } }])
    expect(store.read().prompt.phase).toBe(PromptPhase.Shown)
    interactRelease(ports, store)
    expect(ports.nui.sent).toStrictEqual([progress(PromptState.Holding), progress(PromptState.Completed)])
  })

  it('cancels when released too early, without any reply', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    interactRelease(ports, store)
    expect(ports.nui.sent.at(-1)).toStrictEqual(progress(PromptState.Cancelled))
    expect(ports.replies.attempts).toStrictEqual([])
    expect(store.read().prompt.phase).toBe(PromptPhase.Shown)
  })

  it('traces an undelivered reply', () => {
    const ports = watchedPorts(NOW)
    ports.replies.refuseOwner(FixtureOwner.Garage)
    const store = promptStore()
    interactPress(ports, store)
    ports.clock.advance(HOLD_PROMPT_MS)
    interactRelease(ports, store)
    expect(linesOf(store, ReportKind.ReplyUndelivered).map((line) => line.data)).toStrictEqual([{ owner: FixtureOwner.Garage, reply: ReplyKind.PromptCompleted }])
  })

  it('completes a press prompt at once', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore(PRESS_PROMPT)
    interactPress(ports, store)
    expect(ports.nui.sent).toStrictEqual([{ type: ToPage.PromptProgress, promptId: 'garage/talk', state: PromptState.Completed, holdMs: 0 }])
    expect(ports.replies.delivered).toHaveLength(1)
  })

  it('uses the default duration of a hold prompt without holdMs', () => {
    const ports = watchedPorts(NOW)
    const withoutDuration: Prompt = { version: HOLD_PROMPT.version, id: HOLD_PROMPT.id, label: HOLD_PROMPT.label, mode: HOLD_PROMPT.mode }
    interactPress(ports, promptStore(withoutDuration))
    expect(ports.nui.sent).toStrictEqual([progress(PromptState.Holding, PROMPT_HOLD_DEFAULT_MS)])
  })

  it('does nothing without a visible prompt or while a menu is open', () => {
    const ports = watchedPorts(NOW)
    interactPress(ports, storeWith())
    interactPress(ports, storeWith({ registry: registryWithPrompt(HOLD_PROMPT), mode: UiMode.Panels }))
    expect(ports.nui.sent).toStrictEqual([])
  })

  it('forgets a hold whose prompt was hidden', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    store.write({ ...store.read(), registry: EMPTY_REGISTRY })
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().prompt.phase).toBe(PromptPhase.Shown)
    expect(ports.nui.sent).toHaveLength(1)
  })
})

describe('control 51 on the pad', () => {
  it('holds and cancels through the right d-pad in pad modality', () => {
    const ports = watchedPorts(NOW)
    ports.controls.setUsingKeyboard(false)
    const store = promptStore(HOLD_PROMPT, Modality.Gamepad)
    ports.controls.pressControl(INTERACT_CONTROL)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().prompt.phase).toBe(PromptPhase.Holding)
    ports.controls.endFrame()
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(store.read().prompt.phase).toBe(PromptPhase.Holding)
    ports.controls.releaseControl(INTERACT_CONTROL)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sent.at(-1)).toStrictEqual(progress(PromptState.Cancelled))
  })

  it('is not read in keyboard modality, where the command covers E', () => {
    const ports = watchedPorts(NOW)
    pumpFrame(ports, promptStore(), INPUT_DEFAULTS)
    expect(ports.controls.calls.filter((call) => call.args[0] === INTERACT_CONTROL)).toStrictEqual([])
  })

  it('is not read while a menu is open', () => {
    const ports = watchedPorts(NOW)
    ports.controls.setUsingKeyboard(false)
    pumpFrame(ports, storeWith({ registry: registryWithPrompt(HOLD_PROMPT), modality: Modality.Gamepad, mode: UiMode.Panels }), INPUT_DEFAULTS)
    expect(ports.controls.calls.filter((call) => call.args[0] === INTERACT_CONTROL)).toStrictEqual([])
  })
})

describe('a hold that must not outlive its conditions', () => {
  function padHold(): { ports: ReturnType<typeof watchedPorts>; store: ReturnType<typeof storeWith> } {
    const ports = watchedPorts(NOW)
    ports.controls.setUsingKeyboard(false)
    const store = promptStore(HOLD_PROMPT, Modality.Gamepad)
    ports.controls.pressControl(INTERACT_CONTROL)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    ports.controls.endFrame()
    return { ports, store }
  }

  function expectCancelledWithoutReply(ports: ReturnType<typeof watchedPorts>, store: ReturnType<typeof storeWith>): void {
    expect(ports.nui.sent.at(-1)).toStrictEqual(progress(PromptState.Cancelled))
    expect(ports.replies.attempts).toStrictEqual([])
    expect(store.read().prompt.phase).toBe(PromptPhase.Shown)
  }

  it('cancels a pad hold when a menu opens, even if the full duration then elapses', () => {
    const { ports, store } = padHold()
    store.write({ ...store.read(), mode: UiMode.Panels })
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expectCancelledWithoutReply(ports, store)
  })

  it('cancels a pad hold when the kit pauses', () => {
    const { ports, store } = padHold()
    store.write({ ...store.read(), paused: true })
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expectCancelledWithoutReply(ports, store)
  })

  it('cancels a pad hold when the modality switches to keyboard and mouse', () => {
    const { ports, store } = padHold()
    ports.controls.setUsingKeyboard(true)
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expectCancelledWithoutReply(ports, store)
  })

  it('cancels a command hold when a menu opens', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    store.write({ ...store.read(), mode: UiMode.Panels })
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expectCancelledWithoutReply(ports, store)
  })

  it('keeps a command hold through a modality switch', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    store.write({ ...store.read(), modality: Modality.Gamepad })
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.nui.sent.at(-1)).toStrictEqual(progress(PromptState.Completed))
  })

  it('does not complete another prompt that appeared during the hold', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    store.write({ ...store.read(), registry: { ...EMPTY_REGISTRY, prompts: [{ owner: FixtureOwner.Garage, prompt: HOLD_PROMPT }, { owner: FixtureOwner.Garage, prompt: PRESS_PROMPT }] } })
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    interactRelease(ports, store)
    expect(ports.replies.attempts).toStrictEqual([])
    expect(ports.nui.sent).toStrictEqual([progress(PromptState.Holding)])
    expect(store.read().prompt.phase).toBe(PromptPhase.Shown)
  })

  it('does not complete a prompt of another owner with the same id', () => {
    const ports = watchedPorts(NOW)
    const store = promptStore()
    interactPress(ports, store)
    store.write({ ...store.read(), registry: { ...EMPTY_REGISTRY, prompts: [{ owner: FixtureOwner.Garage, prompt: HOLD_PROMPT }, { owner: OTHER_OWNER, prompt: HOLD_PROMPT }] } })
    ports.clock.advance(HOLD_PROMPT_MS)
    pumpFrame(ports, store, INPUT_DEFAULTS)
    expect(ports.replies.attempts).toStrictEqual([])
  })
})
