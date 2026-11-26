import { describe, expect, it } from 'vitest'
import { transition } from '../../../../src/page/domain/intent-engine'
import { RadialLevel, type UiState } from '../../../../src/page/domain/ui-state'
import { Intent, IntentPhase } from '../../../../src/protocol/intents'
import { OWNED_GARAGE_RADIAL_ENTRY, OWNED_LIST_PANEL, OWNED_WHITELIST_RADIAL_ENTRY } from '../../../fixtures/owned'
import { clientIntent, NOW, OPEN_RADIAL, radialEntries, run, withPanels } from './engine-helpers'

const THIRD_ENTRY = { owner: OWNED_GARAGE_RADIAL_ENTRY.owner, entry: { ...OWNED_GARAGE_RADIAL_ENTRY.entry, id: 'garage/third' } }
const ENTRIES = [OWNED_WHITELIST_RADIAL_ENTRY, OWNED_GARAGE_RADIAL_ENTRY, THIRD_ENTRY]
const FIRST_SEQ = 1
const SECOND_SEQ = 2
const FIRST_SECTOR = 0
const SECOND_SECTOR = 1
const LAST_SECTOR = 2

function openRadial(): UiState {
  return run(withPanels([OWNED_LIST_PANEL]), [radialEntries(ENTRIES), OPEN_RADIAL]).state
}

describe('pad cross in an open radial', () => {
  it('aims the neighboring sector on right, then back on left', () => {
    const right = run(openRadial(), [clientIntent(FIRST_SEQ, Intent.Right)])
    expect(right.state.radial).toMatchObject({ level: RadialLevel.Sectors, sectorIndex: SECOND_SECTOR })
    const left = run(right.state, [clientIntent(SECOND_SEQ, Intent.Left)])
    expect(left.state.radial).toMatchObject({ level: RadialLevel.Sectors, sectorIndex: FIRST_SECTOR })
  })

  it('wraps to the last sector on left from the first one', () => {
    expect(run(openRadial(), [clientIntent(FIRST_SEQ, Intent.Left)]).state.radial.sectorIndex).toBe(LAST_SECTOR)
  })

  it('enters the sub-ring on up and leaves it on down', () => {
    const entered = run(openRadial(), [clientIntent(FIRST_SEQ, Intent.Up)]).state
    expect(entered.radial.level).toBe(RadialLevel.Children)
    expect(run(entered, [clientIntent(SECOND_SEQ, Intent.Down)]).state.radial.level).toBe(RadialLevel.Sectors)
  })
})

describe('release without press', () => {
  it('has no effect and no effect on the page state', () => {
    const state = openRadial()
    const next = transition(state, clientIntent(FIRST_SEQ, Intent.Left, IntentPhase.Release), NOW)
    expect(next.effects).toEqual([])
    expect({ ...next.state, lastIntentSeq: state.lastIntentSeq, ackPending: state.ackPending }).toEqual(state)
  })

  it('counts the intent for the acknowledgement and changes nothing else', () => {
    const next = transition(openRadial(), clientIntent(FIRST_SEQ, Intent.Back, IntentPhase.Release), NOW)
    expect([next.state.lastIntentSeq, next.state.ackPending, next.state.mode]).toEqual([FIRST_SEQ, true, openRadial().mode])
    expect(next.state.backHold).toEqual(openRadial().backHold)
  })

  it('does not release a different held intent', () => {
    const held = run(openRadial(), [clientIntent(FIRST_SEQ, Intent.Right)]).state
    const next = transition(held, clientIntent(SECOND_SEQ, Intent.Left, IntentPhase.Release), NOW)
    expect(next.state.held).toEqual(held.held)
    expect(next.effects).toEqual([])
  })
})
