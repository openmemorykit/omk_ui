import { CloseReason, KitExport, NOTIFICATION_QUEUE_LENGTH, NOTIFICATIONS_PER_SECOND, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { DEFAULT_GLYPH_SET, FALLBACK_LOCALE, LOCALE_CONVAR } from '../../../src/client/application/boot-message'
import { isAuthenticPageCallback, READY_INTERVAL_MS, receiveReady, SESSION_TOKEN_FIELD } from '../../../src/client/application/page-link'
import { ONE_LINE_PER_MINUTE_MS } from '../../../src/client/application/trace'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { FromPage } from '../../../src/protocol/from-page'
import { ToPage } from '../../../src/protocol/to-page'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { ENGLISH_LOCALE } from '../../fixtures/messages'
import { FixtureOwner, OWNED_LIST_PANEL, OWNED_PLAIN_NOTIFICATION, OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'
import { ADD_PANEL, LIST_PANEL } from '../../fixtures/panels'
import { PLAIN_NOTIFICATION, REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { createHarness, createReadyHarness, tracedOfKind, withToken, type UseCaseHarness } from './use-case-harness'

const EXTRA_NOTIFICATIONS = 2
const SECOND_READY = 2

const FRENCH = 'fr'
const HOSTILE_LOCALE = '../../server'
const OTHER_TOKEN = 'forged'
const ONE_SECOND_MS = 1000

function call(harness: UseCaseHarness, name: KitExport, owner: string, ...args: readonly unknown[]): void {
  handleContractCall(harness.context, name, owner, args)
}

function reloadAfter(harness: UseCaseHarness, delayMs: number): void {
  harness.ports.clock.advance(delayMs)
  receiveReady(harness.context)
}

describe('before Ready', () => {
  it('queues notifications, 20 at most, and prints the overflow in the console', () => {
    const harness = createHarness()
    Array.from({ length: NOTIFICATION_QUEUE_LENGTH + EXTRA_NOTIFICATIONS }, () => {
      harness.ports.clock.advance(ONE_SECOND_MS / NOTIFICATIONS_PER_SECOND)
      call(harness, KitExport.Notify, FixtureOwner.Garage, PLAIN_NOTIFICATION)
    })
    expect(harness.store.read().link.queuedNotifications).toHaveLength(NOTIFICATION_QUEUE_LENGTH)
    expect(harness.ports.nui.sent).toStrictEqual([])
    expect(harness.ports.console.printed).toHaveLength(1)
  })

  it('sends the queued notifications right after the Boot, then empties the queue', () => {
    const harness = createHarness()
    call(harness, KitExport.Notify, FixtureOwner.Garage, PLAIN_NOTIFICATION)
    receiveReady(harness.context)
    expect(harness.ports.nui.calls.map((portCall) => portCall.method)).toStrictEqual(['sendBoot', 'send'])
    expect(harness.ports.nui.sentOfType(ToPage.Notify)).toStrictEqual([{ type: ToPage.Notify, notification: OWNED_PLAIN_NOTIFICATION }])
    expect(harness.store.read().link.queuedNotifications).toStrictEqual([])
  })

  it('answers PanelClosed locally for a panel acknowledged Done and closed before the page saw it', () => {
    const harness = createHarness()
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, ADD_PANEL)
    call(harness, KitExport.ClosePanel, FixtureOwner.Whitelist, ADD_PANEL.id)
    expect(harness.ports.replies.delivered).toStrictEqual([
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: LIST_PANEL.id, reason: CloseReason.ClosedByOwner } },
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: ADD_PANEL.id, reason: CloseReason.ClosedByOwner } },
    ])
  })

  it('declines locally a confirmation replaced before the page saw it', () => {
    const harness = createHarness()
    call(harness, KitExport.Confirm, FixtureOwner.Whitelist, REMOVE_CONFIRM)
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)
    expect(harness.ports.replies.delivered).toStrictEqual([
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.ConfirmAnswered, confirmId: REMOVE_CONFIRM.id, confirmed: false } },
    ])
  })
})

describe('Boot', () => {
  it('rebuilds the page from the registry with the next command number and empties the unapplied commands', () => {
    const harness = createHarness()
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)
    receiveReady(harness.context)
    const boot = harness.ports.nui.boots[0]?.message
    expect(boot?.panels).toStrictEqual([OWNED_LIST_PANEL])
    expect(boot?.commandSeq).toBe(1)
    expect(harness.store.read().registry.unapplied).toStrictEqual([])
  })

  it('carries the waiting confirmation, the settings, the bindings and the stored glyph set', () => {
    const harness = createHarness()
    harness.ports.glyphs.write(GlyphSet.PlayStation)
    call(harness, KitExport.Confirm, FixtureOwner.Whitelist, REMOVE_CONFIRM)
    receiveReady(harness.context)
    const boot = harness.ports.nui.boots[0]?.message
    expect(boot?.confirm).toStrictEqual(OWNED_REMOVE_CONFIRM)
    expect(boot?.settings).toStrictEqual(DEFAULT_CONFIG.theme)
    expect(boot?.glyphSet).toBe(GlyphSet.PlayStation)
    expect(boot?.prompt).toBeNull()
  })

  it('uses the locale of the convar, and English when it is absent, unknown or hostile', () => {
    const french = { ...ENGLISH_LOCALE, language: FRENCH }
    const harness = createHarness()
    harness.ports.locales.setBundle(FRENCH, french)
    harness.ports.locales.setBundle(FALLBACK_LOCALE, ENGLISH_LOCALE)
    harness.ports.convars.set(LOCALE_CONVAR, FRENCH)
    receiveReady(harness.context)
    harness.ports.convars.set(LOCALE_CONVAR, HOSTILE_LOCALE)
    reloadAfter(harness, READY_INTERVAL_MS)
    expect(harness.ports.nui.boots.map((boot) => boot.message.locale)).toStrictEqual([french, ENGLISH_LOCALE])
    expect(harness.ports.locales.requested).not.toContain(HOSTILE_LOCALE)
  })

  it('sends an empty English bundle and the default glyph set when nothing can be read', () => {
    const boot = createReadyHarness().ports.nui.boots[0]?.message
    expect(boot?.locale).toStrictEqual({ language: FALLBACK_LOCALE, messages: {} })
    expect(boot?.glyphSet).toBe(DEFAULT_GLYPH_SET)
  })

  it('emits omk_ui:ready at each Boot', () => {
    const harness = createReadyHarness()
    reloadAfter(harness, READY_INTERVAL_MS)
    expect(harness.ports.events.readyCount).toBe(SECOND_READY)
  })
})

describe('session token', () => {
  it('draws a fresh token at each Ready and invalidates the old one', () => {
    const harness = createReadyHarness()
    const first = harness.store.read().link.token
    reloadAfter(harness, READY_INTERVAL_MS)
    const second = harness.store.read().link.token
    expect(second).not.toBe(first)
    expect(harness.ports.nui.boots.map((boot) => boot.sessionToken)).toStrictEqual([first, second])
    expect(isAuthenticPageCallback(harness.context, FromPage.Ack, { [SESSION_TOKEN_FIELD]: first })).toBe(false)
    expect(isAuthenticPageCallback(harness.context, FromPage.Ack, { [SESSION_TOKEN_FIELD]: second })).toBe(true)
  })

  it('draws the token from the random source', () => {
    const harness = createReadyHarness()
    expect(harness.ports.random.drawCount).toBeGreaterThan(0)
  })

  it('ignores a Ready less than 1 s after the last accepted one', () => {
    const harness = createReadyHarness()
    reloadAfter(harness, READY_INTERVAL_MS - 1)
    expect(harness.ports.nui.boots).toHaveLength(1)
  })

  it('logs each Ready after the first one', () => {
    const harness = createReadyHarness()
    reloadAfter(harness, READY_INTERVAL_MS)
    expect(tracedOfKind(harness, ReportKind.PageReloaded).map((line) => line.data)).toStrictEqual([{ readyCount: 2 }])
  })

  it.each([
    ['without a token', {}],
    ['with another token', { [SESSION_TOKEN_FIELD]: OTHER_TOKEN }],
    ['that is not an object', null],
  ])('ignores a callback %s and logs ForgedCall once per minute', (_case, body) => {
    const harness = createReadyHarness()
    expect(isAuthenticPageCallback(harness.context, FromPage.Event, body)).toBe(false)
    expect(isAuthenticPageCallback(harness.context, FromPage.Event, body)).toBe(false)
    expect(tracedOfKind(harness, ReportKind.ForgedCall).map((line) => line.data)).toStrictEqual([{ call: FromPage.Event }])
    harness.ports.clock.advance(ONE_LINE_PER_MINUTE_MS)
    isAuthenticPageCallback(harness.context, FromPage.Ack, body)
    isAuthenticPageCallback(harness.context, FromPage.Event, body)
    expect(tracedOfKind(harness, ReportKind.ForgedCall).map((line) => line.data)).toStrictEqual([{ call: FromPage.Event }, { call: FromPage.Ack }, { call: FromPage.Event }])
  })

  it('refuses every callback before the first Ready', () => {
    const harness = createHarness()
    expect(isAuthenticPageCallback(harness.context, FromPage.Ack, withToken(harness, {}))).toBe(false)
  })
})

describe('reloaded page', () => {
  it('answers PanelClosed for a panel closed while the page was down, before rebuilding', () => {
    const harness = createReadyHarness()
    call(harness, KitExport.OpenPanel, FixtureOwner.Whitelist, LIST_PANEL)
    harness.ports.clock.advance(READY_INTERVAL_MS)
    receiveReady(harness.context)
    call(harness, KitExport.ClosePanel, FixtureOwner.Whitelist, LIST_PANEL.id)
    reloadAfter(harness, READY_INTERVAL_MS)
    expect(harness.ports.replies.delivered).toStrictEqual([
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: LIST_PANEL.id, reason: CloseReason.ClosedByOwner } },
    ])
    expect(harness.ports.nui.boots.at(-1)?.message.panels).toStrictEqual([])
  })
})
