import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, type UiCommand } from '../../../../src/page/domain/page-commands'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import { FromPage } from '../../../../src/protocol/from-page'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { Intent } from '../../../../src/protocol/intents'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { bootWith, closedPanels, throwingConfirm, throwingPanel, events, initial, NOW, OPEN_RADIAL, openPanel, press, pushPanel, radialEntries, repliesOf, run, withPanels } from './engine-helpers'

const STALE_SEQ = 1
const LATER_SEQ = 7
const BOOT_SEQ = 9

describe('transition vocabulary', () => {
  it('keeps page command values apart from client message values', () => {
    const clientTypes: ReadonlySet<string> = new Set(Object.values(ToPage))
    expect(Object.values(PageCommandType).filter((type) => clientTypes.has(type))).toEqual([])
  })

  it.each([
    ['null', null],
    ['an unknown type', { type: 'unknown' }],
    ['an inherited name', { type: 'toString' }],
    ['a prototype name', { type: '__proto__' }],
  ])('ignores %s without throwing', (_, command) => {
    const state = withPanels([OWNED_LIST_PANEL])
    const next = transition(state, command as unknown as UiCommand, NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })
})

describe('transition when a handler throws', () => {
  it('keeps the previous state and sends nothing for a client message', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const next = transition(state, { type: ToPage.Notify, notification: { owner: FixtureOwner.Whitelist, notification: null as never } }, NOW)
    expect(next.state).toBe(state)
    expect(next.effects).toEqual([])
  })

  it('keeps the previous state for an intent whose handler throws', () => {
    const hostileEntry = { owner: FixtureOwner.Whitelist, entry: null as never }
    const radial = run(initial(), [radialEntries([OWNED_WHITELIST_RADIAL_ENTRY]), OPEN_RADIAL]).state
    const broken = { ...radial, radial: { ...radial.radial, entries: [hostileEntry] } }
    const next = transition(broken, press(Intent.Confirm), NOW)
    expect(next.state).toBe(broken)
    expect(next.effects).toEqual([])
  })

  it('answers Discarded for a pushed panel whose handler throws', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const hostile = throwingPanel('hostile')
    const next = transition(state, pushPanel(hostile, OWNED_LIST_PANEL.panel.id, LATER_SEQ), NOW)
    expect(next.state.stack).toBe(state.stack)
    expect(closedPanels(next.effects)).toEqual([{ kind: ReplyKind.PanelClosed, panelId: hostile.panel.id, reason: CloseReason.Discarded }])
  })

  it('answers ConfirmAnswered(false) for a confirmation whose handler throws', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const next = transition(state, { type: ToPage.ShowConfirm, commandSeq: LATER_SEQ, confirm: throwingConfirm() }, NOW)
    expect(next.state.stack).toBe(state.stack)
    expect(repliesOf(next.effects, ReplyKind.ConfirmAnswered)).toEqual([{ kind: ReplyKind.ConfirmAnswered, confirmId: OWNED_REMOVE_CONFIRM.confirm.id, confirmed: false }])
  })

  it('answers Discarded for every Boot panel and refuses the Boot confirmation when Boot throws', () => {
    const state = initial()
    const next = transition(state, bootWith({ panels: [OWNED_LIST_PANEL], confirm: OWNED_REMOVE_CONFIRM, locale: null as never }), NOW)
    expect(next.state.stack).toEqual([])
    expect(repliesOf(next.effects, ReplyKind.PanelClosed).map((reply) => reply.reason)).toEqual([CloseReason.Discarded])
    expect(repliesOf(next.effects, ReplyKind.ConfirmAnswered)).toHaveLength(1)
  })

  it('empties a live stack when Boot throws, so no opening is ever closed twice', () => {
    const confirmed = run(withPanels([OWNED_LIST_PANEL]), [{ type: ToPage.ShowConfirm, commandSeq: LATER_SEQ, confirm: OWNED_REMOVE_CONFIRM }]).state
    const boot = bootWith({ panels: [OWNED_LIST_PANEL], confirm: OWNED_REMOVE_CONFIRM, commandSeq: BOOT_SEQ, locale: null as never })
    const next = run(confirmed, [boot, press(Intent.Back), { type: ToPage.ClosePanel, commandSeq: BOOT_SEQ + 1, panelId: OWNED_LIST_PANEL.panel.id }])
    expect(next.state.stack).toEqual([])
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(next.effects).toEqual([
      {
        type: UiEffectType.SendToHost,
        message: {
          type: FromPage.Event,
          event: {
            stack: { appliedCommandSeq: BOOT_SEQ, entries: [] },
            replies: [
              { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_LIST_PANEL.panel.id, reason: CloseReason.Discarded } },
              { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.ConfirmAnswered, confirmId: OWNED_REMOVE_CONFIRM.confirm.id, confirmed: false } },
            ],
          },
        },
      },
      { type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Idle } },
      { type: UiEffectType.SendToHost, message: { type: FromPage.Event, event: { stack: { appliedCommandSeq: BOOT_SEQ + 1, entries: [] }, replies: [] } } },
    ])
  })
})

describe('transition and stale stack commands', () => {
  it('ignores a stack command whose number is not above the applied one', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const stale = [
      openPanel(menuPanel('other'), STALE_SEQ),
      { type: ToPage.ClosePanel, commandSeq: STALE_SEQ, panelId: OWNED_LIST_PANEL.panel.id },
      { type: ToPage.DropOwner, commandSeq: STALE_SEQ, owner: FixtureOwner.Whitelist },
      { type: ToPage.ShowConfirm, commandSeq: STALE_SEQ, confirm: OWNED_REMOVE_CONFIRM },
      pushPanel(menuPanel('child'), OWNED_LIST_PANEL.panel.id, STALE_SEQ),
      openPanel(menuPanel('nan'), Number.NaN),
    ] satisfies readonly UiCommand[]
    stale.forEach((command) => {
      const next = transition(state, command, NOW)
      expect(next.state).toBe(state)
      expect(next.effects).toEqual([])
    })
  })

  it('applies the next command after a stale one', () => {
    const state = withPanels([OWNED_LIST_PANEL])
    const next = run(state, [openPanel(menuPanel('other'), STALE_SEQ), openPanel(menuPanel('other'), LATER_SEQ)])
    expect(next.state.appliedCommandSeq).toBe(LATER_SEQ)
    expect(events(next.effects)).toHaveLength(1)
    expect(next.effects.some((effect) => 'message' in effect && effect.message.type === FromPage.Event)).toBe(true)
  })
})
