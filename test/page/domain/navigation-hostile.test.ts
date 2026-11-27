import { CloseReason, PANEL_MAX_ITEMS, ReplyKind, STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import {
  closePanelFrame,
  dropOwnerFrames,
  openPanelFrame,
  pushPanelFrame,
  showConfirmLayer,
  updatePanelFrame,
} from '../../../src/page/domain/navigation'
import { stackSnapshot } from '../../../src/page/domain/page-event'
import { createInitialState, type UiState } from '../../../src/page/domain/ui-state'
import { NAMESPACED_ID_MAX_LENGTH } from '../../../src/protocol/namespaced-id'
import type { OwnedConfirm, OwnedPanel } from '../../../src/protocol/owned'
import { fromPageStackSnapshot, type OwnedReply } from '../../../src/protocol/stack'
import { ADD_ACTION } from '../../fixtures/items'
import { FixtureOwner, HOSTILE_NAMESPACED_IDS, OWNED_LIST_PANEL, OWNED_REMOVE_CONFIRM } from '../../fixtures/owned'
import { confirmFor, menuPanel, stackOfDepth } from './navigation-helpers'

const TWO_FRAMES = 2
const NEXT_SEQ = 3
const LOWER_INDEX = 1
const FRACTIONAL_SEQ = 1.5
const BEYOND_SAFE = 2
const WARM_UP_RUNS = 20
const MEASURED_RUNS = 200
const UPDATE_BUDGET_MS = 500
const TOP_PARENT = 'whitelist/level-1'

const withId = (owner: string, id: string): OwnedPanel => ({ owner, panel: { ...OWNED_LIST_PANEL.panel, id } })
const discarded = (panelId: string): readonly OwnedReply[] => [
  { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId, reason: CloseReason.Discarded } },
]
const closedByOwner = (panelId: string): readonly OwnedReply[] => [
  { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId, reason: CloseReason.ClosedByOwner } },
]
const isReadable = (state: UiState): boolean => fromPageStackSnapshot(stackSnapshot(state)) !== null

const UNADDRESSABLE_PANELS: readonly OwnedPanel[] = [
  ...[null, {}, { owner: 1, panel: {} }, { owner: FixtureOwner.Whitelist, panel: null }].map((panel) => panel as unknown as OwnedPanel),
  withId(FixtureOwner.Whitelist, 'list'),
  withId(FixtureOwner.Whitelist, 'garage/list'),
  withId('__proto__', '__proto__/x'),
  withId(FixtureOwner.Whitelist, `whitelist/${'a'.repeat(NAMESPACED_ID_MAX_LENGTH)}`),
  ...HOSTILE_NAMESPACED_IDS.map((id) => withId(FixtureOwner.Whitelist, id)),
]

const malformedItems = (items: unknown): OwnedPanel => ({ owner: FixtureOwner.Whitelist, panel: { ...menuPanel('x').panel, items } }) as unknown as OwnedPanel
const MALFORMED_PANELS: readonly OwnedPanel[] = [
  malformedItems('none'),
  malformedItems([null]),
  malformedItems([{ ...ADD_ACTION, id: 1 }]),
  malformedItems(Array.from({ length: PANEL_MAX_ITEMS + 1 }, () => ADD_ACTION)),
  { owner: FixtureOwner.Whitelist, panel: { ...menuPanel('x').panel, kind: 'unknown' } } as unknown as OwnedPanel,
]

describe('panels whose owner and identifier do not match', () => {
  it.each(UNADDRESSABLE_PANELS.map((panel, index) => [index, panel] as const))('ignores panel %i without reply and keeps the snapshot readable', (_, panel) => {
    const base = stackOfDepth(TWO_FRAMES)
    const opened = openPanelFrame(base, panel, NEXT_SEQ)
    expect(opened.state.stack).toBe(base.stack)
    expect(opened.replies).toEqual([])
    expect(isReadable(opened.state)).toBe(true)
    const pushed = pushPanelFrame(base, panel, TOP_PARENT, NEXT_SEQ)
    expect(pushed.state.stack).toBe(base.stack)
    expect(pushed.replies).toEqual([])
    expect(isReadable(pushed.state)).toBe(true)
    expect(updatePanelFrame(base, panel)).toBe(base)
  })
})

describe('addressable panels with malformed content', () => {
  it.each(MALFORMED_PANELS.map((panel, index) => [index, panel] as const))('discards panel %i with exactly one PanelClosed', (_, panel) => {
    const base = stackOfDepth(TWO_FRAMES)
    const opened = openPanelFrame(base, panel, NEXT_SEQ)
    expect(opened.state.stack).toEqual([])
    expect(opened.replies).toEqual([...closedByOwner(TOP_PARENT), ...closedByOwner('whitelist/level-0'), ...discarded('whitelist/x')])
    const pushed = pushPanelFrame(base, panel, TOP_PARENT, NEXT_SEQ)
    expect(pushed.state.stack).toBe(base.stack)
    expect(pushed.replies).toEqual(discarded('whitelist/x'))
    expect(updatePanelFrame(base, panel)).toBe(base)
  })
})

describe('cross-owner commands', () => {
  it('discards a push onto the top panel of another owner', () => {
    const garage = openPanelFrame(createInitialState(), menuPanel('top', FixtureOwner.Garage), 1).state
    const { state, replies } = pushPanelFrame(garage, menuPanel('x'), 'garage/top', TWO_FRAMES)
    expect(state.stack).toBe(garage.stack)
    expect(replies).toEqual(discarded('whitelist/x'))
  })

  it('ignores a confirmation over the empty confirmation frame of another owner', () => {
    const confirmOnly = showConfirmLayer(createInitialState(), OWNED_REMOVE_CONFIRM, 1)
    expect(showConfirmLayer(confirmOnly, confirmFor(FixtureOwner.Garage), TWO_FRAMES).stack).toBe(confirmOnly.stack)
  })
})

describe('untrusted values', () => {
  it('keeps appliedCommandSeq a valid, increasing number whatever the command number', () => {
    const base = stackOfDepth(TWO_FRAMES)
    const numbers = [Number.NaN, -1, FRACTIONAL_SEQ, Number.POSITIVE_INFINITY, LOWER_INDEX, Number.MAX_SAFE_INTEGER + BEYOND_SAFE]
    numbers.forEach((commandSeq) => {
      const state = closePanelFrame(base, 'whitelist/unknown', commandSeq).state
      expect(state.appliedCommandSeq).toBe(base.appliedCommandSeq)
      expect(isReadable(state)).toBe(true)
    })
  })

  it('ignores hostile panel identifiers, owners and confirmations without throwing', () => {
    const base = stackOfDepth(TWO_FRAMES)
    const identifiers = [undefined, null, '__proto__', 'toString', ...HOSTILE_NAMESPACED_IDS].map((panelId) => panelId as unknown as string)
    identifiers.forEach((panelId) => {
      expect(closePanelFrame(base, panelId, NEXT_SEQ)).toEqual({ state: { ...base, appliedCommandSeq: NEXT_SEQ }, replies: [] })
      expect(dropOwnerFrames(base, panelId, NEXT_SEQ).stack).toBe(base.stack)
      expect(pushPanelFrame(base, menuPanel('x'), panelId, NEXT_SEQ).replies).toEqual(discarded('whitelist/x'))
    })
    const confirms = [null, { owner: FixtureOwner.Whitelist }, { owner: FixtureOwner.Whitelist, confirm: { id: 'remove' } }]
    ;[...confirms, ...HOSTILE_NAMESPACED_IDS.map((id) => ({ owner: FixtureOwner.Whitelist, confirm: { ...OWNED_REMOVE_CONFIRM.confirm, id } }))]
      .map((confirm) => confirm as unknown as OwnedConfirm)
      .forEach((confirm) => {
        expect(showConfirmLayer(base, confirm, NEXT_SEQ).stack).toBe(base.stack)
      })
  })

  it('updates a full panel of a full stack within the time budget', () => {
    const items = Array.from({ length: PANEL_MAX_ITEMS }, (_, index) => ({ ...ADD_ACTION, id: `row-${String(index)}` }))
    const full = updatePanelFrame(stackOfDepth(STACK_MAX_DEPTH), menuPanel('level-7', FixtureOwner.Whitelist, items))
    const shifted = menuPanel('level-7', FixtureOwner.Whitelist, items.slice(1).reverse())
    const run = (): UiState => updatePanelFrame(full, shifted)
    Array.from({ length: WARM_UP_RUNS }).forEach(run)
    const startedAt = Date.now()
    Array.from({ length: MEASURED_RUNS }).forEach(run)
    expect(Date.now() - startedAt).toBeLessThan(UPDATE_BUDGET_MS)
  })
})
