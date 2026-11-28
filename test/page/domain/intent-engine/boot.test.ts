import { CloseReason, PANEL_MAX_ITEMS, ReplyKind, STACK_MAX_DEPTH, type Item } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { BOOT_PANEL_SCAN_MAX } from '../../../../src/page/domain/boot'
import { transition } from '../../../../src/page/domain/intent-engine'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import { LayerKind, RadialLevel } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { GlyphSet, UiMode } from '../../../../src/protocol/page-vocabulary'
import { BINDING_LABELS, ENGLISH_LOCALE } from '../../../fixtures/messages'
import { FixtureOwner, OWNED_GARAGE_RADIAL_ENTRY, OWNED_HOLD_PROMPT, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { SHARED_STACK_OWNED, SHARED_STACK_SEQ, SHARED_STACK_SNAPSHOT } from '../../../fixtures/stack'
import { menuPanel, stackIds } from '../navigation-helpers'
import { bootWith, events, initial, NOW, replies, repliesOf, sentOf, withPanels } from './engine-helpers'

const EXTRA_PANELS = 3
const LOWER_SEQ = 1
const HIGHER_APPLIED = 40
const FRENCH = 'fr'
const WARMUP_PASSES = 5
const MEASURED_PASSES = 20
const BOOT_BUDGET_MS = 500
const HOSTILE_PANELS = 100_000

function chain(count: number): ReturnType<typeof menuPanel>[] {
  return Array.from({ length: count }, (_, index) => menuPanel(`level-${String(index)}`))
}

describe('Boot', () => {
  it('rebuilds the stack, radial and prompt, applies the number and switches to Panels', () => {
    const boot = bootWith({ prompt: OWNED_HOLD_PROMPT, glyphSet: GlyphSet.PlayStation, locale: { ...ENGLISH_LOCALE, language: FRENCH } })
    const next = transition(initial(), boot, NOW)
    expect(stackIds(next.state)).toEqual(SHARED_STACK_OWNED.map((owned) => owned.panel.id))
    expect(next.state.radial.entries).toEqual([OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY])
    expect(next.state.prompt).toEqual({ prompt: OWNED_HOLD_PROMPT, state: null, holdMs: 0, holdStartedAt: null, heldFraction: 0 })
    expect(next.state.appliedCommandSeq).toBe(SHARED_STACK_SEQ.Push)
    expect(next.state.mode).toBe(UiMode.Panels)
    expect(next.state).toMatchObject({ glyphSet: GlyphSet.PlayStation, language: FRENCH, binding: BINDING_LABELS })
    expect(next.effects).toEqual([
      { type: UiEffectType.SendToHost, message: { type: FromPage.Event, event: { stack: SHARED_STACK_SNAPSHOT, replies: [] } } },
      { type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Panels } },
    ])
  })

  it('stays Idle without panels and sends no mode change', () => {
    const next = transition(initial(), bootWith({ panels: [] }), NOW)
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([])
    expect(events(next.effects)).toEqual([{ stack: { appliedCommandSeq: SHARED_STACK_SEQ.Push, entries: [] }, replies: [] }])
  })

  it('never builds more than eight frames and discards every extra panel', () => {
    const panels = chain(STACK_MAX_DEPTH + EXTRA_PANELS)
    const next = transition(initial(), bootWith({ panels }), NOW)
    expect(next.state.stack).toHaveLength(STACK_MAX_DEPTH)
    expect(repliesOf(next.effects, ReplyKind.PanelClosed)).toEqual(
      panels.slice(STACK_MAX_DEPTH).map((owned) => ({ kind: ReplyKind.PanelClosed, panelId: owned.panel.id, reason: CloseReason.Discarded })),
    )
  })

  it('shows the confirmation on the rebuilt top frame', () => {
    const next = transition(initial(), bootWith({ confirm: OWNED_REMOVE_CONFIRM }), NOW)
    expect(next.state.stack[next.state.stack.length - 1]?.layers.map((layer) => layer.kind)).toEqual([LayerKind.Confirm])
    expect(replies(next.effects)).toEqual([])
  })

  it('shows the confirmation alone over an empty stack', () => {
    const next = transition(initial(), bootWith({ panels: [], confirm: OWNED_REMOVE_CONFIRM }), NOW)
    expect(next.state.stack).toHaveLength(1)
    expect(next.state.mode).toBe(UiMode.Panels)
  })

  it('refuses a confirmation it cannot show, so none is left without an answer', () => {
    const next = transition(initial(), bootWith({ panels: [menuPanel('garage-top', FixtureOwner.Garage)], confirm: OWNED_REMOVE_CONFIRM }), NOW)
    expect(events(next.effects)).toHaveLength(1)
    expect(repliesOf(next.effects, ReplyKind.ConfirmAnswered)).toEqual([{ kind: ReplyKind.ConfirmAnswered, confirmId: OWNED_REMOVE_CONFIRM.confirm.id, confirmed: false }])
  })

  it('takes the Boot number even when it is lower than the applied one', () => {
    const live = { ...withPanels([OWNED_LIST_PANEL]), appliedCommandSeq: HIGHER_APPLIED }
    expect(transition(live, bootWith({ commandSeq: LOWER_SEQ }), NOW).state.appliedCommandSeq).toBe(LOWER_SEQ)
  })

  it('keeps the applied number when the Boot number is not a command number', () => {
    const live = { ...withPanels([OWNED_LIST_PANEL]), appliedCommandSeq: HIGHER_APPLIED }
    expect(transition(live, bootWith({ commandSeq: Number.NaN }), NOW).state.appliedCommandSeq).toBe(HIGHER_APPLIED)
  })

  it('replaces a live stack without closing the instances the registry rebuilds', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL, menuPanel('child')]), bootWith({}), NOW)
    expect(replies(next.effects)).toEqual([])
    expect(stackIds(next.state)).toEqual(SHARED_STACK_OWNED.map((owned) => owned.panel.id))
  })

  it('keeps the radial position within the new entries', () => {
    const atChildren = { ...initial(), radial: { entries: [OWNED_WHITELIST_RADIAL_ENTRY], level: RadialLevel.Children, sectorIndex: 0, childIndex: 1 } }
    const next = transition(atChildren, bootWith({ radialEntries: [OWNED_GARAGE_RADIAL_ENTRY] }), NOW)
    expect(next.state.radial).toEqual({ entries: [OWNED_GARAGE_RADIAL_ENTRY], level: RadialLevel.Sectors, sectorIndex: 0, childIndex: null })
  })
})

describe('Boot worst cases', () => {
  it('rebuilds the largest Boot well within budget', () => {
    const items: readonly Item[] = Array.from({ length: PANEL_MAX_ITEMS }, (_, index) => ({ ...OWNED_LIST_PANEL.panel.items[1], id: `item-${String(index)}` }) as Item)
    const panels = Array.from({ length: BOOT_PANEL_SCAN_MAX }, (_, index) => menuPanel(`level-${String(index)}`, FixtureOwner.Whitelist, items))
    const boot = bootWith({ panels })
    for (let pass = 0; pass < WARMUP_PASSES; pass += 1) transition(initial(), boot, NOW)
    const startedAt = performance.now()
    for (let pass = 0; pass < MEASURED_PASSES; pass += 1) transition(initial(), boot, NOW)
    expect(performance.now() - startedAt).toBeLessThan(BOOT_BUDGET_MS)
  })

  it('reads only a bounded number of panels from a hostile Boot', () => {
    const panels = Array.from({ length: HOSTILE_PANELS }, (_, index) => menuPanel(`hostile-${String(index)}`))
    const next = transition(initial(), bootWith({ panels }), NOW)
    expect(next.state.stack).toHaveLength(STACK_MAX_DEPTH)
    expect(events(next.effects)[0]?.replies).toHaveLength(BOOT_PANEL_SCAN_MAX - STACK_MAX_DEPTH)
  })
})
