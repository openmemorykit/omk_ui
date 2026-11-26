import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import { describe, expect, it, vi } from 'vitest'
import { runInvariantLoop } from './invariant-loop'
import { RANDOM_COMMANDS } from './invariant-steps'

vi.mock('../../../../src/page/domain/panel-handlers', async () => {
  const fakes = await import('./fake-panel-handlers')
  return { handleList: fakes.fakeList, handleKeyboardLayer: fakes.fakeKeyboard, handleConfirmLayer: fakes.fakeConfirm }
})

const RANDOM_STEPS = 4000
const SEED = 20_261_127

describe('kit invariants through transition', () => {
  it('answers each opening and each confirmation exactly once over random commands, exceptions included', () => {
    const result = runInvariantLoop(RANDOM_COMMANDS, RANDOM_STEPS, SEED)
    expect(result.textEntriesOff).toBeGreaterThan(0)
    const expected = [...Object.values(CloseReason).filter((reason) => reason !== CloseReason.Back && reason !== CloseReason.KitStopped), ReplyKind.ConfirmAnswered, ReplyKind.RadialSelected]
    expect([...result.reasons].sort()).toEqual(expected.sort())
  })
})
