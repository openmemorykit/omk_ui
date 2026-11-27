import { RejectionReason } from '@openmemorykit/core/shared'
import { CallStatus, ContractErrorCode, KitExport, OpenBlocker, ReplyKind, type CallResult } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { createClientKit, type ClientKit } from '../../../src/client/application/client-kit'
import { KitQuery } from '../../../src/client/application/contract-call'
import { ASK_OWNER, DEMO_OWNERS, demoOwnerOf } from '../../../src/client/application/demos/demo-catalog'
import { BindingCommand } from '../../../src/client/application/boot-message'
import { FocusReleaseReason } from '../../../src/client/application/release-focus'
import { PAGE_SNAPSHOT_WAIT_MS } from '../../../src/client/application/snapshot'
import { FromPage } from '../../../src/protocol/from-page'
import { InputSource, Intent, IntentPhase } from '../../../src/protocol/intents'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../src/protocol/to-page'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ASK_TEXT_MAX_LENGTH, CommandKind, DemoName, NetEvent } from '../../../src/shared/net/net-events'
import { AskOutcome } from '../../../src/shared/report/report-payloads'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { GARAGE_RADIAL_ENTRY, KEYED_NOTIFICATION } from '../../fixtures/surfaces'
import { createClientPortsFake, type ClientPortsFake } from '../fakes/client-ports-fake'

const KIT_VERSION = '0.3.0'
const START_AT = 10_000
const RADIAL_DEMO_OWNERS = ['garage', 'jobs', 'phone', 'settings', 'whitelist'].map(demoOwnerOf)
const CLAIMED_DEMO_OWNER = 'omk_ui_demo_x'
const SERVER_OWNER = 'omk_ui'
const GARAGE_OWNER = 'garage'
const ASK_ID = 4
const QUESTION = 'Do you see the panel?'
const INTENT_COUNT = 3
const PRESS_AND_RELEASE = 2
const ONE_MINUTE_MS = 60_000
const TWO_LINES = 2
const OPENINGS = 2
const REBOUND_KEY = 'F5'
const TOO_LONG_QUESTION = ASK_TEXT_MAX_LENGTH + 1

interface KitHarness {
  readonly ports: ClientPortsFake
  readonly kit: ClientKit
  token(): string
}

function startKit(): KitHarness {
  const ports = createClientPortsFake(START_AT)
  const kit = createClientKit(ports, DEFAULT_CONFIG, KIT_VERSION)
  return { ports, kit, token: () => ports.nui.boots.at(-1)?.sessionToken ?? '' }
}

function readyKit(): KitHarness {
  const harness = startKit()
  harness.kit.pageMessage(FromPage.Ready, { type: FromPage.Ready })
  return harness
}

function fromPage(harness: KitHarness, type: FromPage, body: Readonly<Record<string, unknown>>): void {
  harness.kit.pageMessage(type, { type, ...body, sessionToken: harness.token() })
}

function traced(harness: KitHarness, kind: ReportKind): readonly object[] {
  return harness.ports.server.reports.filter((report) => report.kind === kind).map((report) => report.data)
}

function answerAsk(harness: KitHarness, confirmed: boolean): void {
  const confirmId = harness.ports.nui.sentOfType(ToPage.ShowConfirm).at(-1)?.confirm.confirm.id ?? ''
  fromPage(harness, FromPage.Event, { event: { stack: null, replies: [{ owner: ASK_OWNER, reply: { kind: ReplyKind.ConfirmAnswered, confirmId, confirmed } }] } })
}

function tracingKit(): KitHarness {
  const harness = readyKit()
  harness.kit.serverCommand({ kind: CommandKind.Trace, active: true })
  return harness
}

describe('createClientKit: demos', () => {
  it('registers the five radial entries of demo radial under five demo owners, without QuotaExceeded', () => {
    const harness = tracingKit()
    harness.kit.serverCommand({ kind: CommandKind.Demo, demo: DemoName.Radial })
    const radialEntries = harness.ports.nui.sentOfType(ToPage.RadialEntries)
    expect(new Set(radialEntries.at(-1)?.entries.map((entry) => entry.owner))).toStrictEqual(new Set(RADIAL_DEMO_OWNERS))
    expect(traced(harness, ReportKind.CallLimited)).toStrictEqual([])
    expect(traced(harness, ReportKind.ContractRefused)).toStrictEqual([])
  })

  it('knows every owner of the demo scenarios, the ask owner included, in a closed set', () => {
    expect([...DEMO_OWNERS].sort()).toStrictEqual([ASK_OWNER, ...RADIAL_DEMO_OWNERS].sort())
  })

  it('refuses a real resource that calls itself omk_ui_demo_*, with one ForgedCall line per minute', () => {
    const harness = tracingKit()
    const refused = harness.kit.callExport(KitExport.AddRadialEntry, CLAIMED_DEMO_OWNER, [GARAGE_RADIAL_ENTRY]) as CallResult
    harness.kit.callExport(KitExport.Notify, CLAIMED_DEMO_OWNER, [KEYED_NOTIFICATION])
    expect(refused).toStrictEqual({ status: CallStatus.Refused, errors: [{ path: '', code: ContractErrorCode.BadIdentifier }] })
    expect(traced(harness, ReportKind.ForgedCall)).toHaveLength(1)
    harness.ports.clock.advance(ONE_MINUTE_MS)
    harness.kit.callExport(KitExport.Notify, CLAIMED_DEMO_OWNER, [KEYED_NOTIFICATION])
    expect(traced(harness, ReportKind.ForgedCall)).toHaveLength(TWO_LINES)
    expect(harness.ports.nui.sent.filter((message) => message.type === ToPage.RadialEntries || message.type === ToPage.Notify)).toStrictEqual([])
  })

  it('still answers the version and isOpen queries of any caller', () => {
    const harness = startKit()
    expect(harness.kit.callExport(KitQuery.Version, CLAIMED_DEMO_OWNER, [])).toMatchObject({ kit: KIT_VERSION })
    expect(harness.kit.callExport(KitQuery.IsOpen, null, [])).toBe(false)
  })

  it('plays nothing for a demo name outside the catalog', () => {
    const harness = readyKit()
    const sentBefore = harness.ports.nui.sent.length
    harness.kit.serverCommand({ kind: CommandKind.Demo, demo: 'missing' as DemoName })
    expect(harness.ports.nui.sent).toHaveLength(sentBefore)
  })
})

describe('createClientKit: server commands', () => {
  it('sends n presses and releases of the intent with the console source', () => {
    const harness = readyKit()
    harness.kit.serverCommand({ kind: CommandKind.Intent, intent: Intent.Down, count: INTENT_COUNT })
    const intents = harness.ports.nui.sentOfType(ToPage.Intent)
    expect(intents).toHaveLength(INTENT_COUNT * PRESS_AND_RELEASE)
    expect(intents.map((intent) => intent.phase).slice(0, PRESS_AND_RELEASE)).toStrictEqual([IntentPhase.Press, IntentPhase.Release])
    expect(intents.every((intent) => intent.source === InputSource.Console && intent.intent === Intent.Down)).toBe(true)
    expect(intents.map((intent) => intent.seq)).toStrictEqual(intents.map((_intent, position) => position + 1))
  })

  it('sends CloseAll with a new command number while the radial is open on an empty stack', () => {
    const harness = readyKit()
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Radial })
    harness.kit.serverCommand({ kind: CommandKind.Close })
    expect(harness.ports.nui.sentOfType(ToPage.CloseAll)).toStrictEqual([{ type: ToPage.CloseAll, commandSeq: 1 }])
  })

  it('also removes the radial entries of the demos, so the next Boot has none of them', () => {
    const harness = readyKit()
    harness.kit.callExport(KitExport.AddRadialEntry, GARAGE_OWNER, [GARAGE_RADIAL_ENTRY])
    harness.kit.serverCommand({ kind: CommandKind.Demo, demo: DemoName.Radial })
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Radial })
    harness.kit.serverCommand({ kind: CommandKind.Close })
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Idle })
    harness.ports.clock.advance(ONE_MINUTE_MS)
    harness.kit.pageMessage(FromPage.Ready, { type: FromPage.Ready })
    const owners = harness.ports.nui.boots.at(-1)?.message.radialEntries.map((entry) => entry.owner)
    expect(owners).toStrictEqual([GARAGE_OWNER])
  })

  it('sends no CloseAll while nothing is open', () => {
    const harness = readyKit()
    harness.kit.serverCommand({ kind: CommandKind.Close })
    expect(harness.ports.nui.sentOfType(ToPage.CloseAll)).toStrictEqual([])
  })

  it('shows a server notification under the omk_ui owner', () => {
    const harness = readyKit()
    harness.kit.serverCommand({ kind: CommandKind.Notify, notification: KEYED_NOTIFICATION })
    expect(harness.ports.nui.sentOfType(ToPage.Notify).map((message) => message.notification.owner)).toStrictEqual([SERVER_OWNER])
  })

  it('writes a forged server event once a minute and prints an unreadable one on the console', () => {
    const harness = tracingKit()
    harness.kit.serverEventRejected({ name: NetEvent.Command, source: '', paths: [''], reason: RejectionReason.Source } as never)
    harness.kit.serverEventRejected({ name: NetEvent.Command, source: '', paths: [''], reason: RejectionReason.Source } as never)
    harness.kit.serverEventRejected({ name: NetEvent.Notify, source: '', paths: [''], reason: RejectionReason.Shape } as never)
    expect(traced(harness, ReportKind.ForgedCall)).toStrictEqual([{ call: NetEvent.Command }])
    expect(harness.ports.console.printed.filter((line) => line.includes(NetEvent.Notify))).toHaveLength(1)
  })
})

describe('createClientKit: ask', () => {
  it('shows the question as a confirm of omk_ui_demo_ask and writes the answer as ConfirmAsked', () => {
    const harness = tracingKit()
    harness.kit.serverCommand({ kind: CommandKind.Ask, askId: ASK_ID, text: QUESTION })
    const [shown] = harness.ports.nui.sentOfType(ToPage.ShowConfirm)
    expect(shown?.confirm.owner).toBe(ASK_OWNER)
    expect(shown?.confirm.confirm.text).toBe(QUESTION)
    answerAsk(harness, true)
    expect(traced(harness, ReportKind.ConfirmAsked)).toStrictEqual([{ askId: String(ASK_ID), outcome: AskOutcome.Confirmed }])
    expect(harness.ports.replies.attempts).toStrictEqual([])
  })

  it('writes a declined answer', () => {
    const harness = tracingKit()
    harness.kit.serverCommand({ kind: CommandKind.Ask, askId: ASK_ID, text: QUESTION })
    answerAsk(harness, false)
    expect(traced(harness, ReportKind.ConfirmAsked)).toStrictEqual([{ askId: String(ASK_ID), outcome: AskOutcome.Declined }])
  })

  it('writes a refused opening with the blocker as the reason', () => {
    const harness = tracingKit()
    harness.ports.game.setSituation({ pauseMenuActive: true })
    harness.kit.serverCommand({ kind: CommandKind.Ask, askId: ASK_ID, text: QUESTION })
    expect(traced(harness, ReportKind.ConfirmAsked)).toStrictEqual([{ askId: String(ASK_ID), outcome: AskOutcome.Refused, reason: OpenBlocker.PauseMenu }])
  })

  it('writes a refused contract with the error code as the reason', () => {
    const harness = tracingKit()
    harness.kit.serverCommand({ kind: CommandKind.Ask, askId: ASK_ID, text: 'x'.repeat(TOO_LONG_QUESTION) })
    expect(traced(harness, ReportKind.ConfirmAsked)).toMatchObject([{ askId: String(ASK_ID), outcome: AskOutcome.Refused, reason: ContractErrorCode.TooLong }])
  })
})

describe('createClientKit: page messages and focus', () => {
  it('reads the bindings at each opening, not while the menu stays open', () => {
    const harness = tracingKit()
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Radial })
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Panels })
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Idle })
    harness.ports.controls.setBindingLabel(BindingCommand.Radial, REBOUND_KEY)
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Panels })
    expect(traced(harness, ReportKind.BindingRead)).toHaveLength(OPENINGS)
  })

  it('ignores a page message without the session token', () => {
    const harness = tracingKit()
    harness.kit.pageMessage(FromPage.ModeChanged, { type: FromPage.ModeChanged, mode: UiMode.Radial })
    expect(traced(harness, ReportKind.ModeChanged)).toStrictEqual([])
    expect(traced(harness, ReportKind.ForgedCall)).toStrictEqual([{ call: FromPage.ModeChanged }])
  })

  it('prints an unreadable page message once and ignores an unknown callback', () => {
    const harness = readyKit()
    fromPage(harness, FromPage.Paused, { paused: 'yes' })
    harness.kit.pageMessage('unknown', {})
    expect(harness.ports.console.printed.filter((line) => line.includes(FromPage.Paused))).toHaveLength(1)
  })

  it('follows pause, text entry, escape release and acknowledgements of the page', () => {
    const harness = tracingKit()
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Panels })
    fromPage(harness, FromPage.TextEntry, { active: true })
    fromPage(harness, FromPage.Paused, { paused: true })
    fromPage(harness, FromPage.Ack, { lastIntentSeq: 0 })
    fromPage(harness, FromPage.EscapeReleased, {})
    expect(traced(harness, ReportKind.TextEntry)).toStrictEqual([{ active: true }])
    expect(traced(harness, ReportKind.PagePaused)).toStrictEqual([{ paused: true }])
  })

  it('gives the focus back when the kit stops, even during a pause', () => {
    const harness = tracingKit()
    fromPage(harness, FromPage.ModeChanged, { mode: UiMode.Panels })
    fromPage(harness, FromPage.Paused, { paused: true })
    harness.kit.selfStopping()
    expect(traced(harness, ReportKind.FocusApplied).at(-1)).toMatchObject({ focus: false, reason: FocusReleaseReason.KitStopping })
  })

  it('sends the debug snapshot without the page once its wait has elapsed', () => {
    const harness = readyKit()
    harness.kit.serverCommand({ kind: CommandKind.Snapshot, requestId: 1 })
    harness.kit.expireSnapshot()
    expect(traced(harness, ReportKind.Snapshot)).toStrictEqual([])
    harness.ports.clock.advance(PAGE_SNAPSHOT_WAIT_MS)
    harness.kit.expireSnapshot()
    expect(traced(harness, ReportKind.Snapshot)).toMatchObject([{ page: null }])
  })
})
