import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { fallbackTransition } from '../../../../src/page/domain/command-fallback'
import { transition } from '../../../../src/page/domain/intent-engine'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import type { OwnedPanel } from '../../../../src/protocol/owned'
import type { OwnedReply } from '../../../../src/protocol/stack'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../../fixtures/owned'
import { menuPanel } from '../navigation-helpers'
import { events, NOW, openPanel, throwingPanel, withPanels } from './engine-helpers'

const OPEN_SEQ = 3
const LIST_ID = OWNED_LIST_PANEL.panel.id
const ADD_ID = OWNED_ADD_PANEL.panel.id

const closed = (panelId: string, reason: CloseReason): OwnedReply => ({ owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId, reason } })
const malformedList: OwnedPanel = { owner: FixtureOwner.Whitelist, panel: { ...OWNED_LIST_PANEL.panel, items: [null] } } as unknown as OwnedPanel
const emptyStackAt = (appliedCommandSeq: number): unknown => ({ appliedCommandSeq, entries: [] })

describe('an Open whose panel the page cannot show', () => {
  it('closes the shown instance of the same id before discarding the new one, in one Event', () => {
    const next = transition(withPanels([OWNED_LIST_PANEL]), openPanel(malformedList, OPEN_SEQ), NOW)
    expect(next.state.stack).toEqual([])
    expect(events(next.effects)).toEqual([{ stack: emptyStackAt(OPEN_SEQ), replies: [closed(LIST_ID, CloseReason.ClosedByOwner), closed(LIST_ID, CloseReason.Discarded)] }])
    expect(next.effects.filter((effect) => effect.type === UiEffectType.MeasurePaint || effect.type === UiEffectType.Announce)).toEqual([])
  })

  it('replaces the stack like any Open when its handler throws', () => {
    const hostile = throwingPanel('hostile')
    const next = transition(withPanels([OWNED_LIST_PANEL]), openPanel(hostile, OPEN_SEQ), NOW)
    expect(next.state.stack).toEqual([])
    expect(events(next.effects)).toEqual([{ stack: emptyStackAt(OPEN_SEQ), replies: [closed(LIST_ID, CloseReason.ClosedByOwner), closed(hostile.panel.id, CloseReason.Discarded)] }])
  })
})

describe('the fallback of a stack command whose handler throws', () => {
  const listAndAdd = withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])

  it('cuts the stack at the closed panel, as the registry does', () => {
    const next = fallbackTransition(listAndAdd, { type: ToPage.ClosePanel, commandSeq: OPEN_SEQ, panelId: LIST_ID })
    expect(next.state.stack).toEqual([])
    expect(events(next.effects)).toEqual([{ stack: emptyStackAt(OPEN_SEQ), replies: [closed(ADD_ID, CloseReason.ClosedByOwner), closed(LIST_ID, CloseReason.ClosedByOwner)] }])
  })

  it('removes the frames of a dropped owner, as the registry does', () => {
    const garageOnTop = withPanels([menuPanel('top', FixtureOwner.Garage)])
    const next = fallbackTransition(garageOnTop, { type: ToPage.DropOwner, commandSeq: OPEN_SEQ, owner: FixtureOwner.Garage })
    expect(next.state.stack).toEqual([])
    expect(events(next.effects)).toEqual([{ stack: emptyStackAt(OPEN_SEQ), replies: [] }])
  })
})
