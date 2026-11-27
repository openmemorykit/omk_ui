import { CloseReason, FormOutcome, NOTIFICATION_QUEUE_LENGTH, NOTIFICATIONS_VISIBLE, NotificationTone, RADIAL_MAX_SECTORS, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { FormStatus } from '../../../../src/page/domain/form'
import { pressBack } from '../../../../src/page/domain/hold-detector'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind, type UiCommand } from '../../../../src/page/domain/page-commands'
import { pressHeld } from '../../../../src/page/domain/repeat-policy'
import { DEFAULT_TOAST_DURATION_MS } from '../../../../src/page/domain/toasts'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import { RadialLevel, type UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent, Modality } from '../../../../src/protocol/intents'
import { GlyphSet, PromptState, UiMode } from '../../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../../src/protocol/to-page'
import { FIRST_SNAPSHOT_REQUEST_ID, TO_PAGE_SAMPLES } from '../../../fixtures/messages'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_GARAGE_RADIAL_ENTRY, OWNED_HOLD_PROMPT, OWNED_KEYED_NOTIFICATION, OWNED_LIST_PANEL, OWNED_PLAIN_NOTIFICATION, OWNED_PRESS_PROMPT, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { FIRST_SUBMISSION_ID } from '../../../fixtures/replies'
import { menuPanel, stackIds } from '../navigation-helpers'
import { closedPanels, initial, NOW, radialEntries, run, sentOf, timerFired, withPanels } from './engine-helpers'

const HOLD_MS = 400
const FLOOD = 100
const LATER_MS = 1_000
const STALE_SUBMISSION = FIRST_SUBMISSION_ID + 1
const menuEntry = { owner: FixtureOwner.Whitelist, entry: { ...OWNED_WHITELIST_RADIAL_ENTRY.entry, id: 'whitelist/other' } }

function pendingForm(): UiState {
  const state = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])
  const top = state.stack[1]
  if (top?.form === undefined || top.form === null) throw new Error('form frame expected')
  const form = { ...top.form, status: FormStatus.Pending, submissionId: FIRST_SUBMISSION_ID, pendingSince: NOW }
  return { ...state, stack: [state.stack[0] ?? top, { ...top, form }] }
}

function resolveForm(submissionId: number, keepOpen: boolean | undefined = undefined): typeof TO_PAGE_SAMPLES[typeof ToPage.ResolveForm] {
  const result = keepOpen === undefined ? { outcome: FormOutcome.Accepted } : { outcome: FormOutcome.Accepted, keepOpen }
  return { type: ToPage.ResolveForm, panelId: OWNED_ADD_PANEL.panel.id, submissionId, result }
}

describe('Notify', () => {
  it('queues the toast and schedules its expiry', () => {
    const next = transition(initial(), { type: ToPage.Notify, notification: OWNED_KEYED_NOTIFICATION }, NOW)
    expect(next.state.toasts.visible.map((toast) => toast.owned)).toEqual([OWNED_KEYED_NOTIFICATION])
    expect(next.effects).toEqual([{ type: UiEffectType.Schedule, timer: TimerKind.ToastExpiry, delayMs: DEFAULT_TOAST_DURATION_MS[NotificationTone.Success] }])
  })

  it('keeps the queue bounded under a flood', () => {
    const flood = Array.from({ length: FLOOD }, () => ({ type: ToPage.Notify, notification: OWNED_PLAIN_NOTIFICATION }) as const)
    const { toasts } = run(initial(), flood).state
    expect(toasts.visible).toHaveLength(NOTIFICATIONS_VISIBLE)
    expect(toasts.waiting).toHaveLength(NOTIFICATION_QUEUE_LENGTH)
  })

  it('expires toasts when their timer fires and schedules the next expiry', () => {
    const queued = run(initial(), [{ type: ToPage.Notify, notification: OWNED_PLAIN_NOTIFICATION }]).state
    const queuedLater = run(queued, [{ type: ToPage.Notify, notification: OWNED_KEYED_NOTIFICATION }], NOW + LATER_MS).state
    const at = NOW + DEFAULT_TOAST_DURATION_MS[NotificationTone.Info]
    const next = transition(queuedLater, timerFired(TimerKind.ToastExpiry), at)
    expect(next.state.toasts.visible.map((toast) => toast.owned)).toEqual([OWNED_KEYED_NOTIFICATION])
    expect(next.effects).toEqual([{ type: UiEffectType.Schedule, timer: TimerKind.ToastExpiry, delayMs: LATER_MS }])
  })

  it('schedules a zero delay instead of a delay that is not finite', () => {
    const next = transition(initial(), { type: ToPage.Notify, notification: OWNED_PLAIN_NOTIFICATION }, Number.NaN)
    expect(next.effects).toEqual([{ type: UiEffectType.Schedule, timer: TimerKind.ToastExpiry, delayMs: 0 }])
  })

  it('schedules nothing once the last toast expired', () => {
    const queued = run(initial(), [{ type: ToPage.Notify, notification: OWNED_PLAIN_NOTIFICATION }]).state
    const next = transition(queued, timerFired(TimerKind.ToastExpiry), NOW + DEFAULT_TOAST_DURATION_MS[NotificationTone.Info])
    expect(next.state.toasts.visible).toEqual([])
    expect(next.effects).toEqual([])
  })
})

describe('prompt messages', () => {
  it('shows, advances and hides the prompt', () => {
    const shown = transition(initial(), { type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT }, NOW).state
    expect(shown.prompt).toEqual({ prompt: OWNED_HOLD_PROMPT, state: null, holdMs: 0, holdStartedAt: null, heldFraction: 0 })
    const holding = transition(shown, { type: ToPage.PromptProgress, promptId: OWNED_HOLD_PROMPT.prompt.id, state: PromptState.Holding, holdMs: HOLD_MS }, NOW).state
    expect(holding.prompt).toEqual({ prompt: OWNED_HOLD_PROMPT, state: PromptState.Holding, holdMs: HOLD_MS, holdStartedAt: NOW, heldFraction: 0 })
    expect(transition(holding, { type: ToPage.HidePrompt, promptId: OWNED_HOLD_PROMPT.prompt.id }, NOW).state.prompt).toBeNull()
  })

  it('ignores progress and hiding for another prompt', () => {
    const shown = transition(initial(), { type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT }, NOW).state
    const otherId = OWNED_PRESS_PROMPT.prompt.id
    expect(transition(shown, { type: ToPage.PromptProgress, promptId: otherId, state: PromptState.Holding, holdMs: HOLD_MS }, NOW).state).toBe(shown)
    expect(transition(shown, { type: ToPage.HidePrompt, promptId: otherId }, NOW).state).toBe(shown)
    expect(transition(initial(), { type: ToPage.HidePrompt, promptId: otherId }, NOW).state.prompt).toBeNull()
  })
})

describe('fraction of the hold kept by the page clock', () => {
  const PROMPT_ID = OWNED_HOLD_PROMPT.prompt.id
  const HELD_MS = 600
  const LONG_HOLD_MS = 1_500
  const AFTER_TWO_FIFTHS = 0.4
  const THREE_QUARTERS = 0.75
  const NOTHING_HELD = 0
  const WHOLE_HOLD = 1
  const WAY_PAST_MS = LATER_MS
  const HALF = 0.5
  const progress = (state: PromptState, holdMs: number = HOLD_MS): UiCommand => ({ type: ToPage.PromptProgress, promptId: PROMPT_ID, state, holdMs })
  const shown = (): UiState => transition(initial(), { type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT }, NOW).state
  const at = (state: UiState, command: UiCommand, now: number): UiState => transition(state, command, now).state

  it('keeps the fraction held between holding and cancelled, measured with the page clock', () => {
    const holding = at(shown(), progress(PromptState.Holding, LONG_HOLD_MS), NOW)
    const cancelled = at(holding, progress(PromptState.Cancelled, LONG_HOLD_MS), NOW + HELD_MS)
    expect(cancelled.prompt).toMatchObject({ state: PromptState.Cancelled, heldFraction: AFTER_TWO_FIFTHS })
  })

  it('keeps the first start when holding is repeated', () => {
    const holding = at(shown(), progress(PromptState.Holding), NOW)
    const again = at(holding, progress(PromptState.Holding), NOW + HOLD_MS * HALF)
    expect(again.prompt?.holdStartedAt).toBe(NOW)
    expect(at(again, progress(PromptState.Cancelled), NOW + HOLD_MS * THREE_QUARTERS).prompt?.heldFraction).toBe(THREE_QUARTERS)
  })

  it.each([
    ['without a hold seen first', (): UiState => shown(), NOTHING_HELD],
    ['past the hold duration', (): UiState => at(shown(), progress(PromptState.Holding), NOW), WHOLE_HOLD],
  ])('clamps the fraction %s', (_, start, expected) => {
    const cancelled = at(start(), progress(PromptState.Cancelled), NOW + WAY_PAST_MS)
    expect(cancelled.prompt?.heldFraction).toBe(expected)
  })

  it('falls back on the duration of the prompt when the message gives none, and ignores a clock that is not a number', () => {
    const holding = at(shown(), progress(PromptState.Holding, 0), NOW)
    expect(at(holding, progress(PromptState.Cancelled, 0), NOW + HOLD_MS).prompt?.heldFraction).toBeGreaterThan(0)
    expect(at(holding, progress(PromptState.Cancelled), Number.NaN).prompt?.heldFraction).toBe(0)
  })

  it('counts a completed hold as fully held and forgets the start', () => {
    const holding = at(shown(), progress(PromptState.Holding), NOW)
    expect(at(holding, progress(PromptState.Completed), NOW + HOLD_MS).prompt).toMatchObject({ state: PromptState.Completed, heldFraction: WHOLE_HOLD, holdStartedAt: null })
  })

  it('starts again from nothing on a new hold after a cancel', () => {
    const cancelled = at(at(shown(), progress(PromptState.Holding), NOW), progress(PromptState.Cancelled), NOW + HELD_MS)
    const holding = at(cancelled, progress(PromptState.Holding), NOW + HELD_MS + HELD_MS)
    expect(holding.prompt).toMatchObject({ holdStartedAt: NOW + HELD_MS + HELD_MS, heldFraction: 0 })
  })
})

describe('GlyphSet, Modality and RadialEntries', () => {
  it('switches the glyph set and ignores an unknown one', () => {
    const next = transition(initial(), TO_PAGE_SAMPLES[ToPage.GlyphSet], NOW).state
    expect(next.glyphSet).toBe(GlyphSet.PlayStation)
    expect(transition(next, { type: ToPage.GlyphSet, glyphSet: 'nintendo' as GlyphSet }, NOW).state).toBe(next)
  })

  it.each([
    ['the client', { type: ToPage.Modality, modality: Modality.Gamepad } as const, Modality.Gamepad, Modality.KeyboardMouse],
    ['the page', { type: PageCommandType.LocalModality } as const, Modality.KeyboardMouse, Modality.Gamepad],
  ])('changes the modality from %s and releases every held intent', (_, command, expected, previous) => {
    const held = { ...withPanels([OWNED_LIST_PANEL]), modality: previous, held: pressHeld([], Intent.Down, NOW), backHold: pressBack(NOW), backFromEscape: true }
    const next = transition(held, command, NOW).state
    expect(next).toMatchObject({ modality: expected, held: [], backHold: { pressedAt: null, fired: false }, backFromEscape: false })
  })

  it('ignores a modality that does not change or is unknown', () => {
    const state = initial()
    expect(transition(state, { type: PageCommandType.LocalModality }, NOW).state).toBe(state)
    expect(transition(state, { type: ToPage.Modality, modality: 'joystick' as Modality }, NOW).state).toBe(state)
  })

  it('follows the aimed entry when entries before it change, and leaves the sub-ring of a removed entry', () => {
    const atChild = { ...initial(), radial: { entries: [OWNED_WHITELIST_RADIAL_ENTRY], level: RadialLevel.Children, sectorIndex: 0, childIndex: 1 } }
    const moved = transition(atChild, radialEntries([OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY]), NOW).state
    expect(moved.radial).toMatchObject({ level: RadialLevel.Children, sectorIndex: 1, childIndex: 1 })
    const removed = transition(atChild, radialEntries([menuEntry, OWNED_GARAGE_RADIAL_ENTRY]), NOW).state
    expect(removed.radial).toMatchObject({ level: RadialLevel.Sectors, sectorIndex: 0, childIndex: null })
  })

  it('replaces the radial entries, bounded, keeping the position when it still exists', () => {
    const atChild = { ...initial(), radial: { entries: [OWNED_WHITELIST_RADIAL_ENTRY], level: RadialLevel.Children, sectorIndex: 0, childIndex: 1 } }
    const next = transition(atChild, radialEntries([OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY]), NOW).state
    expect(next.radial).toEqual({ entries: [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY], level: RadialLevel.Children, sectorIndex: 0, childIndex: 1 })
    const atGarage = { ...initial(), radial: { entries: [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY], level: RadialLevel.Sectors, sectorIndex: 1, childIndex: null } }
    expect(transition(atGarage, radialEntries([OWNED_GARAGE_RADIAL_ENTRY]), NOW).state.radial).toMatchObject({ sectorIndex: 0, level: RadialLevel.Sectors })
    const flood = Array.from({ length: FLOOD }, () => OWNED_GARAGE_RADIAL_ENTRY)
    expect(transition(initial(), radialEntries(flood), NOW).state.radial.entries.length).toBeLessThanOrEqual(RADIAL_MAX_SECTORS)
  })
})

describe('UpdatePanel', () => {
  it('replaces the panel and keeps the focus on the same item', () => {
    const opened = withPanels([OWNED_LIST_PANEL])
    const top = opened.stack[0]
    if (top === undefined) throw new Error('frame expected')
    const focused = { ...opened, stack: [{ ...top, focusItemId: 'player-1' }] }
    const updated = menuPanel('list', FixtureOwner.Whitelist, OWNED_LIST_PANEL.panel.items.slice().reverse())
    const next = transition(focused, { type: ToPage.UpdatePanel, panel: updated }, NOW)
    expect(next.state.stack[0]?.panel).toBe(updated)
    expect(next.state.stack[0]?.focusItemId).toBe('player-1')
    expect(next.effects).toEqual([])
  })
})

describe('ResolveForm', () => {
  it('closes the accepted form frame with one Event', () => {
    const next = transition(pendingForm(), resolveForm(FIRST_SUBMISSION_ID), NOW)
    expect(stackIds(next.state)).toEqual([OWNED_LIST_PANEL.panel.id])
    expect(closedPanels(next.effects)).toEqual([{ kind: ReplyKind.PanelClosed, panelId: OWNED_ADD_PANEL.panel.id, reason: CloseReason.ClosedByOwner }])
  })

  it('keeps the frame open with keepOpen and settles the form', () => {
    const next = transition(pendingForm(), resolveForm(FIRST_SUBMISSION_ID, true), NOW)
    expect(next.state.stack[1]?.form?.status).toBe(FormStatus.Editing)
    expect(next.effects).toEqual([])
  })

  it('shows the rejection on the form', () => {
    const next = transition(pendingForm(), TO_PAGE_SAMPLES[ToPage.ResolveForm], NOW)
    expect(next.state.stack[1]?.form).toMatchObject({ status: FormStatus.Rejected, errors: { identifier: { message: 'Already allowed' } } })
  })

  it('ignores an old submission and an unknown panel', () => {
    const state = pendingForm()
    expect(transition(state, resolveForm(STALE_SUBMISSION), NOW).state).toBe(state)
    expect(transition(state, { ...resolveForm(FIRST_SUBMISSION_ID), panelId: 'whitelist/unknown' }, NOW).state).toBe(state)
  })
})

describe('SnapshotRequest', () => {
  it('answers with a readable snapshot of the page', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), TO_PAGE_SAMPLES[ToPage.SnapshotRequest], NOW)
    expect(sentOf(next.effects, FromPage.Snapshot)).toEqual([{
      type: FromPage.Snapshot,
      requestId: FIRST_SNAPSHOT_REQUEST_ID,
      snapshot: expect.objectContaining({ mode: UiMode.Panels, stack: [OWNED_LIST_PANEL.panel.id], paused: false }) as unknown,
    }])
  })
})
