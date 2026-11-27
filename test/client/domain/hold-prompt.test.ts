import { PromptMode } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { advancePrompt, cancelPrompt, HoldSource, PromptPhase, pressPrompt, releasePrompt, SHOWN_PROMPT, type HeldPrompt, type PromptHold } from '../../../src/client/domain/hold-prompt'

const SHORT_DELAY = 100
const MIDDLE_DELAY = 500
const MAX_HOLD = 5000
const HUGE_HOLD = 1_000_000

const START = 10_000
const HOLD_MS = 1200
const HELD: HeldPrompt = { owner: 'garage', promptId: 'open-door', source: HoldSource.Pad }

describe('hold prompt', () => {
  it('starts shown', () => {
    expect(SHOWN_PROMPT).toEqual({ phase: PromptPhase.Shown })
  })

  it('completes a full hold, by release or by advance', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(holding).toEqual({ phase: PromptPhase.Holding, startedAt: START, held: HELD })
    expect(advancePrompt(holding, START + HOLD_MS, HOLD_MS).phase).toBe(PromptPhase.Completed)
    expect(releasePrompt(holding, START + HOLD_MS, HOLD_MS).phase).toBe(PromptPhase.Completed)
  })

  it('cancels a release at 1199 ms', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(releasePrompt(holding, START + HOLD_MS - 1, HOLD_MS).phase).toBe(PromptPhase.Cancelled)
  })

  it('keeps holding while advance is too early', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(advancePrompt(holding, START + HOLD_MS - 1, HOLD_MS)).toBe(holding)
  })

  it('completes at once in press mode', () => {
    expect(pressPrompt(SHOWN_PROMPT, PromptMode.Press, START, HELD).phase).toBe(PromptPhase.Completed)
  })

  it('keeps two prompts independent', () => {
    const first = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    const second = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START + MIDDLE_DELAY, HELD)
    expect(releasePrompt(first, START + HOLD_MS, HOLD_MS).phase).toBe(PromptPhase.Completed)
    expect(releasePrompt(second, START + HOLD_MS, HOLD_MS).phase).toBe(PromptPhase.Cancelled)
    expect(SHOWN_PROMPT).toEqual({ phase: PromptPhase.Shown })
  })

  it.each([PromptPhase.Completed, PromptPhase.Cancelled] as const)('does not leave the final phase %s', (phase) => {
    const final: PromptHold = { phase }
    expect(pressPrompt(final, PromptMode.Hold, START, HELD)).toBe(final)
    expect(pressPrompt(final, PromptMode.Press, START, HELD)).toBe(final)
    expect(releasePrompt(final, START, HOLD_MS)).toBe(final)
    expect(advancePrompt(final, START + HOLD_MS, HOLD_MS)).toBe(final)
  })

  it('ignores release and advance before any press', () => {
    expect(releasePrompt(SHOWN_PROMPT, START, HOLD_MS)).toBe(SHOWN_PROMPT)
    expect(advancePrompt(SHOWN_PROMPT, START, HOLD_MS)).toBe(SHOWN_PROMPT)
  })

  it('ignores a second press while holding', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(pressPrompt(holding, PromptMode.Hold, START + SHORT_DELAY, HELD)).toBe(holding)
  })

  it('fails closed on a clock or duration that is not finite, and on a clock going back', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(advancePrompt(holding, Number.NaN, HOLD_MS)).toBe(holding)
    expect(releasePrompt(holding, Number.POSITIVE_INFINITY, HOLD_MS).phase).toBe(PromptPhase.Cancelled)
    expect(releasePrompt(holding, START + HOLD_MS, Number.NaN).phase).toBe(PromptPhase.Cancelled)
    expect(releasePrompt(holding, START - MAX_HOLD, HOLD_MS).phase).toBe(PromptPhase.Cancelled)
    expect(pressPrompt(SHOWN_PROMPT, PromptMode.Press, Number.NaN, HELD)).toBe(SHOWN_PROMPT)
  })

  it('bounds the hold to the contract maximum', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(advancePrompt(holding, START + MAX_HOLD, HUGE_HOLD).phase).toBe(PromptPhase.Completed)
    expect(advancePrompt(holding, START + MAX_HOLD - 1, HUGE_HOLD)).toBe(holding)
  })

  it('does not mutate a frozen state', () => {
    const holding = Object.freeze({ phase: PromptPhase.Holding, startedAt: START, held: HELD })
    expect(() => advancePrompt(holding, START + HOLD_MS, HOLD_MS)).not.toThrow()
    expect(holding).toEqual({ phase: PromptPhase.Holding, startedAt: START, held: HELD })
  })

  it('remembers which prompt is held and where the hold started', () => {
    expect(pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)).toEqual({ phase: PromptPhase.Holding, startedAt: START, held: HELD })
  })

  it('cancels a hold on demand, and leaves any other phase alone', () => {
    const holding = pressPrompt(SHOWN_PROMPT, PromptMode.Hold, START, HELD)
    expect(cancelPrompt(holding).phase).toBe(PromptPhase.Cancelled)
    expect(cancelPrompt(SHOWN_PROMPT)).toBe(SHOWN_PROMPT)
  })
})
