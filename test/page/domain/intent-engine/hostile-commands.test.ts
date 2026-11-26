import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { fallbackTransition } from '../../../../src/page/domain/command-fallback'
import { transition } from '../../../../src/page/domain/intent-engine'
import { TimerKind } from '../../../../src/page/domain/page-commands'
import { Intent, Modality } from '../../../../src/protocol/intents'
import { GlyphSet } from '../../../../src/protocol/page-vocabulary'
import { FromPage } from '../../../../src/protocol/from-page'
import { ToPage } from '../../../../src/protocol/to-page'
import { ENGLISH_LOCALE } from '../../../fixtures/messages'
import { FixtureOwner, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { bootWith, events, initial, NOW, press, replies, run, sentOf, timerFired, withPanels } from './engine-helpers'

const SEQ = 5
const OLD_SEQ = 0
const NOT_A_NUMBER = 42
const HOSTILE_ID = 1.5

describe('Boot with hostile fields', () => {
  it('rebuilds an empty stack when the panels are not a list', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), bootWith({ panels: 'panels' as never }), NOW)
    expect(next.state.stack).toEqual([])
    expect(replies(next.effects)).toEqual([])
  })

  it('keeps the glyph set and the language it had when Boot carries unusable ones', () => {
    const before = initial()
    const next = transition(before, bootWith({ glyphSet: 'bogus' as never, locale: { ...ENGLISH_LOCALE, language: NOT_A_NUMBER as never } }), NOW)
    expect([next.state.glyphSet, next.state.language]).toEqual([before.glyphSet, before.language])
    expect(before.glyphSet).toBe(GlyphSet.Xbox)
  })

  it('discards a panel that follows a refused first panel, closing it as Discarded', () => {
    const refused = { owner: FixtureOwner.Whitelist, panel: { id: 'garage/other' } } as never
    const next = transition(initial(), bootWith({ panels: [refused, OWNED_LIST_PANEL], commandSeq: SEQ }), NOW)
    expect(next.state.stack).toEqual([])
    expect(replies(next.effects)).toEqual([{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_LIST_PANEL.panel.id, reason: CloseReason.Discarded } }])
  })
})

describe('toast expiry and snapshots', () => {
  it('keeps the state when no toast is due', () => {
    const state = initial()
    expect(transition(state, timerFired(TimerKind.ToastExpiry), NOW)).toEqual({ state, effects: [] })
  })

  it('names no panel for a frame that holds a confirmation only', () => {
    const asked = run(initial(), [{ type: ToPage.ShowConfirm, commandSeq: 1, confirm: OWNED_REMOVE_CONFIRM }]).state
    const next = transition(asked, { type: ToPage.SnapshotRequest, requestId: 1 }, NOW)
    expect(sentOf(next.effects, FromPage.Snapshot)[0]?.snapshot).toMatchObject({ stack: [null] })
  })

  it('ignores a snapshot request without a safe integer id', () => {
    const state = initial()
    expect(transition(state, { type: ToPage.SnapshotRequest, requestId: HOSTILE_ID }, NOW)).toEqual({ state, effects: [] })
  })
})

describe('fallbackTransition', () => {
  const discarded = (effects: ReturnType<typeof fallbackTransition>['effects']): readonly unknown[] => events(effects).flatMap((event) => event.replies)

  it('sends no reply for an open panel that names no addressable panel, and keeps the number', () => {
    const next = fallbackTransition(initial(), { type: ToPage.OpenPanel, commandSeq: SEQ, panel: 'garbage' })
    expect(next.state.appliedCommandSeq).toBe(SEQ)
    expect(discarded(next.effects)).toEqual([])
  })

  it('owes nothing for a close or a dropped owner, but keeps the number', () => {
    const closed = fallbackTransition(initial(), { type: ToPage.ClosePanel, commandSeq: SEQ, panelId: 'whitelist/list' })
    const dropped = fallbackTransition(initial(), { type: ToPage.DropOwner, commandSeq: SEQ, owner: FixtureOwner.Whitelist })
    expect([closed.state.appliedCommandSeq, dropped.state.appliedCommandSeq]).toEqual([SEQ, SEQ])
    expect([discarded(closed.effects), discarded(dropped.effects)]).toEqual([[], []])
  })

  it('does nothing for a command it owes nothing for', () => {
    const state = initial()
    expect(fallbackTransition(state, { type: ToPage.Modality, commandSeq: SEQ, modality: Modality.Gamepad })).toEqual({ state, effects: [] })
  })

  it('does nothing for a command that is not newer than the applied one', () => {
    const state = { ...initial(), appliedCommandSeq: SEQ }
    expect(fallbackTransition(state, { type: ToPage.OpenPanel, commandSeq: OLD_SEQ, panel: menuPanel('late') })).toEqual({ state, effects: [] })
  })
})

describe('timers with a clock that is not a number', () => {
  it('keeps a held direction as it is when the repeat timer fires', () => {
    const state = initial()
    expect(transition(state, timerFired(TimerKind.Repeat), Number.NaN)).toEqual({ state, effects: [] })
  })

  it('sends nothing and plans nothing when the back hold fires', () => {
    const held = run(withPanels([OWNED_LIST_PANEL]), [press(Intent.Back)]).state
    expect(transition(held, timerFired(TimerKind.BackHold), Number.NaN).effects).toEqual([])
  })

  it('ignores a timer it does not know', () => {
    const state = initial()
    expect(transition(state, timerFired('unknown' as never), NOW)).toEqual({ state, effects: [] })
  })
})
