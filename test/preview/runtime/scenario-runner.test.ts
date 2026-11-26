import { CallStatus, CloseReason, ContractErrorCode, KitExport, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../preview/runtime/preview-settings'
import { createPreviewRuntime, LOG_MAX_ENTRIES, SCENARIO_TIMER } from '../../../preview/runtime/scenario-runner'
import { LogKind, ScenarioId, StepKind, type FakeResourceFactory, type PreviewRuntime, type ScenarioEntry, type ScenarioStep } from '../../../preview/runtime/types'
import { FromPage } from '../../../src/protocol/from-page'
import { InputSource, Intent, IntentPhase } from '../../../src/protocol/intents'
import { ToPage, type ToPageMessage } from '../../../src/protocol/to-page'
import { LIST_PANEL } from '../../fixtures/panels'
import { createFakeTime, forwardingRecorder, messagesOf, READY, type FakeTime, type RecordingResource } from './runtime-helpers'

const OPEN_LIST: ScenarioStep = { kind: StepKind.Call, owner: 'whitelist', name: KitExport.OpenPanel, args: [LIST_PANEL] }
const CLOSE_LIST: ScenarioStep = { kind: StepKind.Call, owner: 'whitelist', name: KitExport.ClosePanel, args: ['list'] }
const PRESS_DOWN: ScenarioStep = { kind: StepKind.Client, message: { type: ToPage.Intent, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad } }
const WAIT_MS = 400
const LATER_MS = 25
const INTENTS_PLAYED = 4
const FIRST_SEQS = Array.from({ length: INTENTS_PLAYED }, (_, index) => index + 1)
const OPENS = 2
const LOG_OVERFLOW = 3

interface Setup {
  readonly runtime: PreviewRuntime
  readonly time: FakeTime
  readonly sent: ToPageMessage[]
}

function setup(entries: Readonly<Record<string, ScenarioEntry>>): Setup {
  const time = createFakeTime()
  const runtime = createPreviewRuntime({ clock: time.clock, scheduler: time.scheduler, catalog: new Map(Object.entries(entries)) })
  const sent: ToPageMessage[] = []
  runtime.listen((message) => void sent.push(message))
  return { runtime, time, sent }
}

function entryOf(steps: readonly ScenarioStep[], resources: ReadonlyMap<string, FakeResourceFactory> = new Map()): ScenarioEntry {
  return { scenario: { id: ScenarioId.WhitelistList, steps }, resources }
}

describe('preview runtime start', () => {
  it('waits for Ready, then boots and plays the steps', () => {
    const { runtime, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([OPEN_LIST]) })
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    expect(sent).toEqual([])
    expect(runtime.settled()).toBe(false)
    runtime.deliver(READY)
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot, ToPage.OpenPanel])
    expect(runtime.settled()).toBe(true)
  })

  it('boots again on every Ready without replaying the steps', () => {
    const { runtime, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([OPEN_LIST]) })
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    runtime.deliver(READY)
    runtime.deliver(READY)
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot, ToPage.OpenPanel, ToPage.Boot])
    expect(messagesOf(sent, ToPage.Boot)[1]?.panels).toHaveLength(1)
  })

  it('boots at once when the page is already ready, keeping commandSeq increasing', () => {
    const { runtime, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([OPEN_LIST]) })
    runtime.deliver(READY)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot, ToPage.OpenPanel, ToPage.Boot, ToPage.OpenPanel])
    expect(messagesOf(sent, ToPage.OpenPanel).map((message) => message.commandSeq)).toEqual(FIRST_SEQS.slice(0, OPENS))
    expect(messagesOf(sent, ToPage.Boot)[1]?.commandSeq).toBe(1)
  })

  it('stops an invalid scenario with its errors: an empty Boot and no step', () => {
    const invalid: ScenarioStep = { ...OPEN_LIST, args: [{ ...LIST_PANEL, version: 2 }] }
    const { runtime, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([invalid, PRESS_DOWN]) })
    runtime.deliver(READY)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot])
    expect(runtime.settled()).toBe(false)
    expect(runtime.log().map((entry) => entry.event)).toContainEqual({
      kind: LogKind.ScenarioRefused,
      scenarioId: ScenarioId.WhitelistList,
      errors: [expect.objectContaining({ path: 'steps.0.args.0.version', code: ContractErrorCode.UnsupportedVersion })],
    })
  })

  it('stops a scenario missing from the catalog', () => {
    const { runtime } = setup({})
    runtime.start(ScenarioId.Radial, DEFAULT_PREVIEW_SETTINGS)
    expect(runtime.log().map((entry) => entry.event)).toEqual([
      { kind: LogKind.ScenarioRefused, scenarioId: ScenarioId.Radial, errors: [{ path: 'id', code: ContractErrorCode.UnknownValue, detail: ScenarioId.Radial }] },
    ])
  })

  it('has an empty catalog by default', () => {
    const time = createFakeTime()
    const runtime = createPreviewRuntime({ clock: time.clock, scheduler: time.scheduler })
    runtime.start(ScenarioId.Toasts, DEFAULT_PREVIEW_SETTINGS)
    expect(runtime.log()[0]?.event.kind).toBe(LogKind.ScenarioRefused)
  })
})

describe('preview runtime steps', () => {
  it('waits on the injected scheduler before the next step', () => {
    const { runtime, time, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([OPEN_LIST, { kind: StepKind.Wait, delayMs: WAIT_MS }, CLOSE_LIST]) })
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    runtime.deliver(READY)
    expect(time.timers.get(SCENARIO_TIMER)?.delayMs).toBe(WAIT_MS)
    expect(runtime.settled()).toBe(false)
    time.fire(SCENARIO_TIMER)
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot, ToPage.OpenPanel, ToPage.ClosePanel])
    expect(runtime.settled()).toBe(true)
  })

  it('cancels the pending wait on restart and ignores a stale timer', () => {
    const { runtime, time, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([{ kind: StepKind.Wait, delayMs: WAIT_MS }, CLOSE_LIST]) })
    runtime.deliver(READY)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    const stale = time.timers.get(SCENARIO_TIMER)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    expect(time.cancelled).toEqual([SCENARIO_TIMER, SCENARIO_TIMER])
    stale?.fire()
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot, ToPage.Boot])
  })

  it('numbers the client intents across restarts', () => {
    const { runtime, sent } = setup({ [ScenarioId.WhitelistList]: entryOf([PRESS_DOWN, PRESS_DOWN]) })
    runtime.deliver(READY)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    expect(messagesOf(sent, ToPage.Intent).map((message) => message.seq)).toEqual(FIRST_SEQS)
    expect(messagesOf(sent, ToPage.Intent)[0]).toEqual({ type: ToPage.Intent, seq: 1, intent: Intent.Down, phase: IntentPhase.Press, source: InputSource.Pad })
  })

  it('plays each call through the resource of its owner, which receives its replies', () => {
    let resource: RecordingResource | null = null
    const factory: FakeResourceFactory = (kit) => {
      resource = forwardingRecorder(kit)
      return resource
    }
    const { runtime } = setup({ [ScenarioId.WhitelistList]: entryOf([OPEN_LIST], new Map([['whitelist', factory]])) })
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    runtime.deliver(READY)
    runtime.deliver({ type: FromPage.Event, event: { stack: null, replies: [{ owner: 'whitelist', reply: { kind: ReplyKind.ItemSelected, panelId: 'whitelist/list', itemId: 'add' } }] } })
    expect(resource).toMatchObject({ calls: [{ name: KitExport.OpenPanel, payload: [LIST_PANEL] }], replies: [{ panelId: 'list', itemId: 'add' }] })
    expect(runtime.log().map((entry) => entry.event)).toContainEqual({ kind: LogKind.Call, owner: 'whitelist', name: KitExport.OpenPanel, result: { status: CallStatus.Done } })
  })

  it('forwards the calls of an owner without a resource and swallows its replies', () => {
    const { runtime } = setup({ [ScenarioId.WhitelistList]: entryOf([OPEN_LIST]) })
    runtime.start(ScenarioId.WhitelistList, DEFAULT_PREVIEW_SETTINGS)
    runtime.deliver(READY)
    const closed = { kind: ReplyKind.PanelClosed, panelId: 'whitelist/list', reason: CloseReason.Back } as const
    runtime.deliver({ type: FromPage.Event, event: { stack: { appliedCommandSeq: 1, entries: [] }, replies: [{ owner: 'whitelist', reply: closed }] } })
    expect(runtime.log().map((entry) => entry.event)).toContainEqual({ kind: LogKind.Reply, owner: 'whitelist', reply: { ...closed, panelId: 'list' } })
  })
})

describe('preview runtime log and listeners', () => {
  it('stamps each entry with the injected clock and notifies until unsubscribed', () => {
    const { runtime, time } = setup({})
    let notified = 0
    const stop = runtime.onLog(() => (notified += 1))
    time.time.now = LATER_MS
    runtime.deliver(READY)
    stop()
    runtime.deliver(READY)
    expect(runtime.log()[0]).toEqual({ at: LATER_MS, event: { kind: LogKind.FromPage, message: READY } })
    expect(notified).toBe(1)
  })

  it('keeps the newest entries up to the bound', () => {
    const { runtime } = setup({})
    Array.from({ length: LOG_MAX_ENTRIES + LOG_OVERFLOW }).forEach((_, index) => runtime.deliver({ type: FromPage.Ack, lastIntentSeq: index }))
    expect(runtime.log()).toHaveLength(LOG_MAX_ENTRIES)
    expect(runtime.log()[0]?.event).toEqual({ kind: LogKind.FromPage, message: { type: FromPage.Ack, lastIntentSeq: LOG_OVERFLOW } })
  })

  it('stops sending to a listener once detached', () => {
    const { runtime, sent } = setup({})
    const extra: ToPageMessage[] = []
    const detach = runtime.listen((message) => void extra.push(message))
    detach()
    runtime.deliver(READY)
    runtime.start(ScenarioId.Radial, DEFAULT_PREVIEW_SETTINGS)
    expect(extra).toEqual([])
    expect(sent.map((message) => message.type)).toEqual([ToPage.Boot])
  })
})
