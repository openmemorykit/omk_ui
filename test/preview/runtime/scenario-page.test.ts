import { KitExport, ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../preview/runtime/preview-settings'
import { createPreviewRuntime } from '../../../preview/runtime/scenario-runner'
import { ScenarioId, StepKind, type FakeKit, type FakeResourceFactory, type PreviewRuntime, type Scenario, type ScenarioStep } from '../../../preview/runtime/types'
import { LayerKind } from '../../../src/page/domain/ui-state'
import { InputSource, Intent, IntentPhase } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, PLAIN_NOTIFICATION, REMOVE_CONFIRM, WHITELIST_RADIAL_ENTRY } from '../../fixtures/surfaces'
import { createFakeTime, createPageDriver, forwardingRecorder, menu, READY, type PageDriver } from './runtime-helpers'

const WAIT_MS = 200
const STACK_COMMANDS = 3

function call(owner: string, name: KitExport, ...args: unknown[]): ScenarioStep {
  return { kind: StepKind.Call, owner, name, args }
}

function intent(value: Intent, phase: IntentPhase): ScenarioStep {
  return { kind: StepKind.Client, message: { type: ToPage.Intent, intent: value, phase, source: InputSource.Pad } }
}

function play(scenario: Scenario, resources: ReadonlyMap<string, FakeResourceFactory> = new Map()): { readonly runtime: PreviewRuntime; readonly page: PageDriver; readonly fireWait: () => void } {
  const time = createFakeTime()
  const runtime = createPreviewRuntime({ clock: time.clock, scheduler: time.scheduler, catalog: new Map([[scenario.id, { scenario, resources }]]) })
  const page = createPageDriver((message) => runtime.deliver(message))
  runtime.listen((message) => page.dispatch(message))
  runtime.start(scenario.id, DEFAULT_PREVIEW_SETTINGS)
  runtime.deliver(READY)
  return { runtime, page, fireWait: () => [...time.timers.values()].forEach((timer) => timer.fire()) }
}

describe('a local scenario played on the real page transition', () => {
  it('leads the page to a two-level stack with a confirmation, a prompt and a toast', () => {
    const scenario: Scenario = {
      id: ScenarioId.ConfirmDanger,
      steps: [
        call('whitelist', KitExport.OpenPanel, LIST_PANEL),
        call('whitelist', KitExport.PushPanel, ADD_PANEL, 'list'),
        { kind: StepKind.Wait, delayMs: WAIT_MS },
        call('whitelist', KitExport.Confirm, REMOVE_CONFIRM),
        call('garage', KitExport.ShowPrompt, HOLD_PROMPT),
        call('garage', KitExport.Notify, PLAIN_NOTIFICATION),
      ],
    }
    const { runtime, page, fireWait } = play(scenario)
    expect(page.state().stack.map((frame) => frame.panel?.panel.id)).toEqual(['whitelist/list', 'whitelist/add'])
    expect(runtime.settled()).toBe(false)
    fireWait()
    const state = page.state()
    expect(runtime.settled()).toBe(true)
    expect(state.mode).toBe(UiMode.Panels)
    expect(state.appliedCommandSeq).toBe(STACK_COMMANDS)
    expect(state.stack[1]?.layers.map((layer) => layer.kind)).toEqual([LayerKind.Confirm])
    expect(state.prompt?.prompt.prompt.id).toBe('garage/open-door')
    expect(state.toasts.visible.map((toast) => toast.owned.notification.title)).toEqual([PLAIN_NOTIFICATION.title])
  })

  it('opens the radial, selects a sector and lets the chosen resource open its panel', () => {
    const replies: Reply[] = []
    const opener: FakeResourceFactory = (kit: FakeKit) => forwardingRecorder(kit, (reply) => {
      replies.push(reply)
      if (reply.kind === ReplyKind.RadialSelected) kit.call(KitExport.OpenPanel, [menu('garage-menu', 'Garage')])
    })
    const scenario: Scenario = {
      id: ScenarioId.Radial,
      steps: [
        call('garage', KitExport.AddRadialEntry, GARAGE_RADIAL_ENTRY),
        call('whitelist', KitExport.AddRadialEntry, WHITELIST_RADIAL_ENTRY),
        { kind: StepKind.Client, message: { type: ToPage.OpenRadial } },
        intent(Intent.Confirm, IntentPhase.Press),
        intent(Intent.Confirm, IntentPhase.Release),
      ],
    }
    const { runtime, page } = play(scenario, new Map([['garage', opener]]))
    expect(replies).toEqual([{ kind: ReplyKind.RadialSelected, entryId: 'main' }])
    expect(page.state().mode).toBe(UiMode.Panels)
    expect(page.state().stack.map((frame) => frame.panel?.panel.id)).toEqual(['garage/garage-menu'])
    expect(runtime.settled()).toBe(true)
  })
})
