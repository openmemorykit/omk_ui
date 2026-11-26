import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { PageCommandType, TimerKind, WAITING_TIMEOUT_MS } from '../../../../src/page/domain/page-commands'
import { UiEffectType } from '../../../../src/page/domain/ui-effects'
import { RadialLevel, type UiState } from '../../../../src/page/domain/ui-state'
import { FromPage } from '../../../../src/protocol/from-page'
import { Intent } from '../../../../src/protocol/intents'
import { UiMode } from '../../../../src/protocol/page-vocabulary'
import { ToPage } from '../../../../src/protocol/to-page'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_GARAGE_RADIAL_ENTRY, OWNED_LIST_PANEL, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { events, initial, NOW, OPEN_RADIAL, press, radialEntries, run, sentOf, withPanels } from './engine-helpers'

const WHITELIST_SECTOR = 0
const GARAGE_SECTOR = 1
const HALF = 0.5
const FULL = 1
const INSIDE_DEADZONE = 0.1
const ENTRIES = [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY]
const CHILDREN = OWNED_WHITELIST_RADIAL_ENTRY.entry.children ?? []

function radialOver(state: UiState): UiState {
  return run(state, [radialEntries(ENTRIES), OPEN_RADIAL]).state
}

function stick(x: number, y: number): { readonly type: typeof ToPage.Stick; readonly x: number; readonly y: number } {
  return { type: ToPage.Stick, x, y }
}

describe('OpenRadial', () => {
  it('switches to Radial and keeps the last position', () => {
    const positioned = { ...initial(), radial: { entries: ENTRIES, level: RadialLevel.Children, sectorIndex: WHITELIST_SECTOR, childIndex: 1 } }
    const next = transition(positioned, OPEN_RADIAL, NOW)
    expect(next.state.mode).toBe(UiMode.Radial)
    expect(next.state.radial).toBe(positioned.radial)
    expect(next.effects).toEqual([{ type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Radial } }])
  })

  it('does nothing when the radial is already open', () => {
    const open = radialOver(initial())
    const next = transition(open, OPEN_RADIAL, NOW)
    expect(next.state).toBe(open)
    expect(next.effects).toEqual([])
  })
})

describe('radial aiming', () => {
  it('aims the sector under a stick vector and ignores the dead zone', () => {
    const aimed = transition(radialOver(initial()), stick(0, HALF), NOW).state
    expect(aimed.radial).toMatchObject({ level: RadialLevel.Sectors, sectorIndex: GARAGE_SECTOR })
    expect(transition(aimed, stick(INSIDE_DEADZONE, 0), NOW).state).toBe(aimed)
  })

  it('enters the sub-ring when the stick pushes far toward a sector with children', () => {
    const next = transition(radialOver(initial()), stick(0, -FULL), NOW).state
    expect(next.radial).toMatchObject({ level: RadialLevel.Children, sectorIndex: WHITELIST_SECTOR })
    expect(next.radial.childIndex).not.toBeNull()
  })

  it('aims with the pointer and ignores a pointer outside the ring', () => {
    const aimed = transition(radialOver(initial()), { type: PageCommandType.PointerAim, vector: { x: 0, y: HALF } }, NOW).state
    expect(aimed.radial.sectorIndex).toBe(GARAGE_SECTOR)
    expect(transition(aimed, { type: PageCommandType.PointerAim, vector: null }, NOW).state).toBe(aimed)
  })
})

describe('radial directions', () => {
  it('moves to the neighbour sector and wraps around', () => {
    const open = radialOver(initial())
    expect(transition(open, press(Intent.Right), NOW).state.radial.sectorIndex).toBe(GARAGE_SECTOR)
    expect(transition(open, press(Intent.Left), NOW).state.radial.sectorIndex).toBe(GARAGE_SECTOR)
  })

  it('enters the sub-ring with up only when the sector has children, and leaves it with down', () => {
    const open = radialOver(initial())
    const children = transition(open, press(Intent.Up), NOW).state
    expect(children.radial).toMatchObject({ level: RadialLevel.Children, childIndex: 0 })
    expect(transition(children, press(Intent.Down), NOW).state.radial).toMatchObject({ level: RadialLevel.Sectors, childIndex: null })
    const onLeaf = transition(open, press(Intent.Right), NOW).state
    expect(transition(onLeaf, press(Intent.Up), NOW).state.radial).toBe(onLeaf.radial)
  })

  it('moves between neighbour children without leaving the sub-ring', () => {
    const children = run(radialOver(initial()), [press(Intent.Up)]).state
    const moved = transition(children, press(Intent.Right), NOW).state
    expect(moved.radial).toMatchObject({ level: RadialLevel.Children, childIndex: 1 })
    expect(transition(moved, press(Intent.Right), NOW).state.radial.childIndex).toBe(CHILDREN.length - 1)
    expect(transition(children, press(Intent.Left), NOW).state.radial.childIndex).toBe(0)
  })
})

describe('radial confirm', () => {
  it('selects a leaf with one Event that empties the stack, then waits for the chosen resource', () => {
    const open = run(radialOver(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL])), [press(Intent.Right)]).state
    const next = transition(open, press(Intent.Confirm), NOW)
    expect(next.state.stack).toEqual([])
    expect(next.state.mode).toBe(UiMode.Waiting)
    expect(next.effects).toEqual([
      {
        type: UiEffectType.SendToHost,
        message: {
          type: FromPage.Event,
          event: {
            stack: { appliedCommandSeq: open.appliedCommandSeq, entries: [] },
            replies: [
              { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_ADD_PANEL.panel.id, reason: CloseReason.RadialSelection } },
              { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.PanelClosed, panelId: OWNED_LIST_PANEL.panel.id, reason: CloseReason.RadialSelection } },
              { owner: FixtureOwner.Garage, reply: { kind: ReplyKind.RadialSelected, entryId: OWNED_GARAGE_RADIAL_ENTRY.entry.id } },
            ],
          },
        },
      },
      { type: UiEffectType.Schedule, timer: TimerKind.WaitingTimeout, delayMs: WAITING_TIMEOUT_MS },
      { type: UiEffectType.SendToHost, message: { type: FromPage.ModeChanged, mode: UiMode.Waiting } },
    ])
  })

  it('enters the sub-ring on a sector with children, then selects the child', () => {
    const open = radialOver(initial())
    const children = transition(open, press(Intent.Confirm), NOW)
    expect(children.state.radial.level).toBe(RadialLevel.Children)
    expect(children.effects).toEqual([])
    const selected = transition(children.state, press(Intent.Confirm), NOW)
    expect(events(selected.effects)[0]?.replies).toEqual([
      { owner: FixtureOwner.Whitelist, reply: { kind: ReplyKind.RadialSelected, entryId: OWNED_WHITELIST_RADIAL_ENTRY.entry.id, childId: CHILDREN[0]?.id } },
    ])
  })

  it('does nothing without entries', () => {
    const empty = run(initial(), [OPEN_RADIAL]).state
    const confirmed = transition(empty, press(Intent.Confirm), NOW)
    expect(confirmed.state.radial).toBe(empty.radial)
    expect(confirmed.state.mode).toBe(UiMode.Radial)
    expect(confirmed.effects).toEqual([])
    expect(transition(empty, press(Intent.Right), NOW).state.radial).toBe(empty.radial)
  })
})

describe('radial back and close', () => {
  it('goes up one level, then closes', () => {
    const children = run(radialOver(initial()), [press(Intent.Up)]).state
    const sectors = transition(children, press(Intent.Back), NOW)
    expect(sectors.state.mode).toBe(UiMode.Radial)
    expect(sectors.state.radial.level).toBe(RadialLevel.Sectors)
    const closed = transition(sectors.state, press(Intent.Back), NOW)
    expect(closed.state.mode).toBe(UiMode.Idle)
  })

  it('closes from any level with the radial intent, back to the panels when some are open', () => {
    const children = run(radialOver(withPanels([OWNED_LIST_PANEL])), [press(Intent.Up)]).state
    const next = transition(children, press(Intent.Radial), NOW)
    expect(next.state.mode).toBe(UiMode.Panels)
    expect(sentOf(next.effects, FromPage.ModeChanged)).toEqual([{ type: FromPage.ModeChanged, mode: UiMode.Panels }])
  })

  it('reopens where the player left it', () => {
    const left = run(radialOver(initial()), [press(Intent.Up), press(Intent.Right), press(Intent.Radial), OPEN_RADIAL]).state
    expect(left.radial).toMatchObject({ level: RadialLevel.Children, childIndex: 1 })
  })
})
