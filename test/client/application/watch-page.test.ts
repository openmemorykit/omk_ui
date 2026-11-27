import { describe, expect, it } from 'vitest'
import { reserveForSelectedOwner, RESERVATION_MS } from '../../../src/client/application/reservation'
import { FocusReleaseReason } from '../../../src/client/application/release-focus'
import { INITIAL_CLIENT_SESSION, type ClientSession } from '../../../src/client/application/session-state'
import { acknowledgeIntents, PAGE_SILENCE_MS, watchPage } from '../../../src/client/application/watch-page'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner } from '../../fixtures/owned'
import { createReadyHarness, tracedOfKind, withToken, type UseCaseHarness } from './use-case-harness'

const SENT_INTENTS = 5
const PARTIAL_ACK = 3

function sentIntents(harness: UseCaseHarness, mode: UiMode): void {
  const session = harness.store.read()
  const next: ClientSession = { ...session, mode, link: { ...session.link, intentSeq: SENT_INTENTS, unackedSince: harness.ports.clock.now() } }
  harness.store.write(next)
}

function acknowledge(harness: UseCaseHarness, lastIntentSeq: unknown): void {
  acknowledgeIntents(harness.context, withToken(harness, { lastIntentSeq }))
}

describe('acknowledgeIntents', () => {
  it('clears the wait once the page acknowledged the last intent', () => {
    const harness = createReadyHarness()
    sentIntents(harness, UiMode.Panels)
    acknowledge(harness, SENT_INTENTS)
    expect(harness.store.read().link).toMatchObject({ lastAckSeq: SENT_INTENTS, unackedSince: null })
  })

  it('restarts the wait from now after a partial acknowledgement', () => {
    const harness = createReadyHarness()
    sentIntents(harness, UiMode.Panels)
    harness.ports.clock.advance(PAGE_SILENCE_MS - 1)
    acknowledge(harness, PARTIAL_ACK)
    expect(harness.store.read().link).toMatchObject({ lastAckSeq: PARTIAL_ACK, unackedSince: harness.ports.clock.now() })
  })

  it.each([SENT_INTENTS + 1, -1, 'five', null])('ignores the acknowledgement %j', (lastIntentSeq) => {
    const harness = createReadyHarness()
    sentIntents(harness, UiMode.Panels)
    const before = harness.store.read().link
    acknowledge(harness, lastIntentSeq)
    expect(harness.store.read().link).toBe(before)
  })

  it('ignores a body without the field', () => {
    const harness = createReadyHarness()
    const before = harness.store.read().link
    acknowledgeIntents(harness.context, null)
    expect(harness.store.read().link).toBe(before)
  })
})

describe('watchPage', () => {
  it('gives the focus back and logs PageUnresponsive after 5 s without Ack outside Idle', () => {
    const harness = createReadyHarness()
    sentIntents(harness, UiMode.Panels)
    harness.ports.clock.advance(PAGE_SILENCE_MS - 1)
    watchPage(harness.context)
    expect(tracedOfKind(harness, ReportKind.PageUnresponsive)).toStrictEqual([])
    harness.ports.clock.advance(1)
    watchPage(harness.context)
    expect(tracedOfKind(harness, ReportKind.PageUnresponsive).map((line) => line.data)).toStrictEqual([{ silentMs: PAGE_SILENCE_MS, intentSeq: SENT_INTENTS, lastAckSeq: 0 }])
    expect(tracedOfKind(harness, ReportKind.FocusApplied).at(-1)?.data).toMatchObject({ focus: false, reason: FocusReleaseReason.PageUnresponsive })
    expect(harness.ports.nui.focusChanges.at(-1)).toStrictEqual({ focus: false, cursor: false })
  })

  it('fires once per silence and leaves the mode to the page messages', () => {
    const harness = createReadyHarness()
    sentIntents(harness, UiMode.Panels)
    harness.ports.clock.advance(PAGE_SILENCE_MS)
    watchPage(harness.context)
    watchPage(harness.context)
    expect(harness.store.read().mode).toBe(UiMode.Panels)
    expect(tracedOfKind(harness, ReportKind.PageUnresponsive)).toHaveLength(1)
    expect(tracedOfKind(harness, ReportKind.ModeChanged)).toStrictEqual([])
  })

  it('never fires in Idle', () => {
    const harness = createReadyHarness()
    sentIntents(harness, UiMode.Idle)
    harness.ports.clock.advance(PAGE_SILENCE_MS)
    watchPage(harness.context)
    expect(tracedOfKind(harness, ReportKind.PageUnresponsive)).toStrictEqual([])
  })

  it('ends the reservation of the radial selection after 1 s', () => {
    const harness = createReadyHarness({ ...INITIAL_CLIENT_SESSION })
    reserveForSelectedOwner(harness.context, FixtureOwner.Whitelist)
    harness.ports.clock.advance(RESERVATION_MS - 1)
    watchPage(harness.context)
    expect(harness.store.read().gate.reservedFor).toBe(FixtureOwner.Whitelist)
    harness.ports.clock.advance(1)
    watchPage(harness.context)
    expect(harness.store.read().gate.reservedFor).toBeNull()
  })
})
