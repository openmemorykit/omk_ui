import { describe, expect, it } from 'vitest'
import { EMPTY_REGISTRY, openPanel, reconcileStack, settleConfirm, showConfirm } from '../../../src/client/domain/owner-registry'
import type { RegistryState } from '../../../src/client/domain/owner-registry'
import { pageAppliedCommandSeq } from '../../../src/client/domain/registry-stack'
import type { StackEntry } from '../../../src/protocol/stack'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { registryAfter } from './registry-helpers'

const { Whitelist } = FixtureOwner
const LIST_ENTRY: StackEntry = { panelId: 'whitelist/list', owner: Whitelist }
const FIRST_CONFIRM_SEQ = 1
const OPEN_SEQ = 2
const SECOND_CONFIRM_SEQ = 3

const pageApplied = (registry: RegistryState, appliedCommandSeq: number): RegistryState => reconcileStack(registry, { appliedCommandSeq, entries: [LIST_ENTRY] })

function askedAgainAfterAnOpen(): RegistryState {
  const firstShown = pageApplied(registryAfter(showConfirm(EMPTY_REGISTRY, Whitelist, REMOVE_CONFIRM)), FIRST_CONFIRM_SEQ)
  const opened = registryAfter(openPanel(firstShown, Whitelist, LIST_PANEL))
  return registryAfter(showConfirm(opened, Whitelist, REMOVE_CONFIRM))
}

describe('a late answer to a withdrawn confirmation', () => {
  it('keeps the command number of its ShowConfirm with the confirmation', () => {
    expect(askedAgainAfterAnOpen().confirms).toStrictEqual([{ owner: Whitelist, confirm: REMOVE_CONFIRM, seq: SECOND_CONFIRM_SEQ }])
  })

  it('does not settle a new confirmation of the same id that the page has not shown yet', () => {
    const openApplied = pageApplied(askedAgainAfterAnOpen(), OPEN_SEQ)
    expect(settleConfirm(openApplied, Whitelist, REMOVE_CONFIRM.id)).toBe(openApplied)
  })

  it('settles the new confirmation once the page has applied its ShowConfirm', () => {
    const shownAgain = pageApplied(askedAgainAfterAnOpen(), SECOND_CONFIRM_SEQ)
    expect(settleConfirm(shownAgain, Whitelist, REMOVE_CONFIRM.id).confirms).toStrictEqual([])
  })
})

describe('pageAppliedCommandSeq', () => {
  it('is the number before the oldest command the page has not applied', () => {
    expect(pageAppliedCommandSeq(askedAgainAfterAnOpen())).toBe(FIRST_CONFIRM_SEQ)
  })

  it('is the last number issued once the page has applied every command', () => {
    expect(pageAppliedCommandSeq(pageApplied(askedAgainAfterAnOpen(), SECOND_CONFIRM_SEQ))).toBe(SECOND_CONFIRM_SEQ)
    expect(pageAppliedCommandSeq(EMPTY_REGISTRY)).toBe(EMPTY_REGISTRY.commandSeq)
  })
})
