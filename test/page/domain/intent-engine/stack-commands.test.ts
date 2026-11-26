import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { Announcement, UiEffectType } from '../../../../src/page/domain/ui-effects'
import { LayerKind } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../../src/protocol/to-page'
import {
  FixtureOwner,
  OWNED_ADD_PANEL,
  OWNED_GARAGE_RADIAL_ENTRY,
  OWNED_HOLD_PROMPT,
  OWNED_LIST_PANEL,
  OWNED_REMOVE_CONFIRM,
  OWNED_WHITELIST_RADIAL_ENTRY,
} from '../../../fixtures/owned'
import { confirmFor, menuPanel, stackIds } from '../navigation-helpers'
import { closedPanels, events, initial, NOW, openPanel, pushPanel, radialEntries, replies, repliesOf, run, sentOf, withPanels } from './engine-helpers'

const NEXT_SEQ = 3
const LIST_ENTRY = { panelId: OWNED_LIST_PANEL.panel.id, owner: FixtureOwner.Whitelist }

describe('OpenPanel', () => {
  it('opens the panel, switches to Panels and measures the paint', () => {
    const next = transition(initial(), openPanel(OWNED_LIST_PANEL, 1), NOW)
    expect(next.state.mode).toBe(UiMode.Panels)
    expect(stackIds(next.state)).toEqual([OWNED_LIST_PANEL.panel.id])
    expect(next.effects).toEqual([
      { type: UiEffectType.SendToHost, message: { type: FromPage.Event, event: { stack: { appliedCommandSeq: 1, entries: [LIST_ENTRY] }, replies: [] } } },
      { type: UiEffectType.MeasurePaint, panelId: OWNED_LIST_PANEL.panel.id },
      { type: UiEffectType.Announce, announcement: Announcement.PanelOpened, params: { panelId: OWNED_LIST_PANEL.panel.id, title: OWNED_LIST_PANEL.panel.title } },
      { type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Panels } },
    ])
  })

  it('does not announce the mode again when Panels is already the mode', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), openPanel(OWNED_ADD_PANEL, NEXT_SEQ), NOW)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([])
  })

  it('closes the reopened instance once and sends nothing for the new one in the same Event', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), openPanel(OWNED_LIST_PANEL, NEXT_SEQ), NOW)
    expect(events(next.effects)).toHaveLength(1)
    expect(replies(next.effects)).toEqual([
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_LIST_PANEL.panel.id, reason: CloseReason.ClosedByOwner } },
    ])
    expect(stackIds(next.state)).toEqual([OWNED_LIST_PANEL.panel.id])
  })
})

describe('PushPanel', () => {
  it('pushes the panel and measures its paint', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), pushPanel(OWNED_ADD_PANEL, OWNED_LIST_PANEL.panel.id, NEXT_SEQ), NOW)
    expect(stackIds(next.state)).toEqual([OWNED_LIST_PANEL.panel.id, OWNED_ADD_PANEL.panel.id])
    expect(next.effects).toEqual([
      {
        type: UiEffectType.SendToHost,
        message: {
          type: FromPage.Event,
          event: { stack: { appliedCommandSeq: NEXT_SEQ, entries: [LIST_ENTRY, { panelId: OWNED_ADD_PANEL.panel.id, owner: FixtureOwner.Whitelist }] }, replies: [] },
        },
      },
      { type: UiEffectType.MeasurePaint, panelId: OWNED_ADD_PANEL.panel.id },
      { type: UiEffectType.Announce, announcement: Announcement.PanelOpened, params: { panelId: OWNED_ADD_PANEL.panel.id, title: OWNED_ADD_PANEL.panel.title } },
    ])
  })

  it('answers Discarded in the Event when the parent is no longer on top, and measures nothing', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), pushPanel(OWNED_ADD_PANEL, 'whitelist/gone', NEXT_SEQ), NOW)
    expect(stackIds(next.state)).toEqual([OWNED_LIST_PANEL.panel.id])
    expect(events(next.effects)).toEqual([{
      stack: { appliedCommandSeq: NEXT_SEQ, entries: [LIST_ENTRY] },
      replies: [{ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_ADD_PANEL.panel.id, reason: CloseReason.Discarded } }],
    }])
    expect(next.effects.filter((effect) => effect.type === UiEffectType.MeasurePaint)).toEqual([])
  })
})

describe('ClosePanel', () => {
  it('answers ClosedByOwner and goes back to Idle when the stack empties', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), { type: ToPage.ClosePanel, commandSeq: NEXT_SEQ, panelId: OWNED_LIST_PANEL.panel.id }, NOW)
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(next.state.stack).toEqual([])
    expect(closedPanels(next.effects)).toEqual([{ kind: ReplyKind.PanelClosed, panelId: OWNED_LIST_PANEL.panel.id, reason: CloseReason.ClosedByOwner }])
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Idle }])
  })

  it('sends one Event for an unknown panel so the applied number moves on', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), { type: ToPage.ClosePanel, commandSeq: NEXT_SEQ, panelId: 'whitelist/unknown' }, NOW)
    expect(events(next.effects)).toEqual([{ stack: { appliedCommandSeq: NEXT_SEQ, entries: [LIST_ENTRY] }, replies: [] }])
  })
})

describe('DropOwner', () => {
  it('removes the owner frames, prompt and radial entries, and sends the stack', () => {
    const garagePanel = menuPanel('garage-top', FixtureOwner.Garage)
    const surfaces = [{ type: ToPage.ShowPrompt, prompt: OWNED_HOLD_PROMPT }, radialEntries([OWNED_GARAGE_RADIAL_ENTRY, OWNED_WHITELIST_RADIAL_ENTRY])] as const
    const garage = run(withPanels([garagePanel]), surfaces).state
    const next = transition(garage, { type: ToPage.DropOwner, commandSeq: NEXT_SEQ, owner: FixtureOwner.Garage }, NOW)
    expect(next.state.stack).toEqual([])
    expect(next.state.prompt).toBeNull()
    expect(next.state.radial.entries).toEqual([OWNED_WHITELIST_RADIAL_ENTRY])
    expect(next.state.mode).toBe(UiMode.Idle)
    expect(events(next.effects)).toEqual([{ stack: { appliedCommandSeq: NEXT_SEQ, entries: [] }, replies: [] }])
  })
})

describe('ShowConfirm', () => {
  it('shows the confirmation over an empty stack and switches to Panels', () => {
    const next = transition(initial(), { type: ToPage.ShowConfirm, commandSeq: 1, confirm: OWNED_REMOVE_CONFIRM }, NOW)
    expect(next.state.mode).toBe(UiMode.Panels)
    expect(next.state.stack[0]?.layers.map((layer) => layer.kind)).toEqual([LayerKind.Confirm])
    expect(events(next.effects)).toEqual([{ stack: { appliedCommandSeq: 1, entries: [] }, replies: [] }])
  })

  it('answers ConfirmAnswered(false) when the layer is refused', () => {
    const garageTop = withPanels([menuPanel('garage-top', FixtureOwner.Garage)])
    const next = transition(garageTop, { type: ToPage.ShowConfirm, commandSeq: NEXT_SEQ, confirm: OWNED_REMOVE_CONFIRM }, NOW)
    expect(next.state.stack).toBe(garageTop.stack)
    expect(events(next.effects)).toHaveLength(1)
    expect(repliesOf(next.effects, ReplyKind.ConfirmAnswered)).toEqual([{ kind: ReplyKind.ConfirmAnswered, confirmId: OWNED_REMOVE_CONFIRM.confirm.id, confirmed: false }])
  })

  it('does not answer a duplicate of a confirmation already shown', () => {
    const shown = transition(withPanels([OWNED_LIST_PANEL]), { type: ToPage.ShowConfirm, commandSeq: NEXT_SEQ, confirm: OWNED_REMOVE_CONFIRM }, NOW).state
    const next = transition(shown, { type: ToPage.ShowConfirm, commandSeq: NEXT_SEQ + 1, confirm: OWNED_REMOVE_CONFIRM }, NOW)
    expect(replies(next.effects)).toEqual([])
    expect(next.state.stack).toBe(shown.stack)
  })

  it('does not answer a confirmation that cannot be addressed', () => {
    const hostile = { owner: FixtureOwner.Whitelist, confirm: { ...confirmFor(FixtureOwner.Garage).confirm } }
    const next = transition(withPanels([OWNED_LIST_PANEL]), { type: ToPage.ShowConfirm, commandSeq: NEXT_SEQ, confirm: hostile }, NOW)
    expect(replies(next.effects)).toEqual([])
  })
})
