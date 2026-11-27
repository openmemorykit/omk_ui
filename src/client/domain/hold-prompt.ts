import { PROMPT_HOLD_MAX_MS, PromptMode } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'
import { PromptState } from '../../protocol/page-vocabulary'

export const PromptPhase = { Shown: 'shown', ...PromptState } as const

export const HoldSource = { Command: 'command', Pad: 'pad' } as const
export type HoldSource = ValueOf<typeof HoldSource>

export interface HeldPrompt {
  readonly owner: string
  readonly promptId: string
  readonly source: HoldSource
}

export type PromptHold =
  | { readonly phase: typeof PromptPhase.Shown }
  | { readonly phase: typeof PromptPhase.Holding; readonly startedAt: number; readonly held: HeldPrompt }
  | { readonly phase: typeof PromptPhase.Completed }
  | { readonly phase: typeof PromptPhase.Cancelled }

export const SHOWN_PROMPT: PromptHold = Object.freeze({ phase: PromptPhase.Shown })
const COMPLETED_PROMPT: PromptHold = Object.freeze({ phase: PromptPhase.Completed })
const CANCELLED_PROMPT: PromptHold = Object.freeze({ phase: PromptPhase.Cancelled })

function heldLongEnough(startedAt: number, now: number, holdMs: number): boolean {
  if (!Number.isFinite(now) || !Number.isFinite(holdMs)) return false
  return now - startedAt >= Math.min(Math.max(holdMs, 0), PROMPT_HOLD_MAX_MS)
}

export function pressPrompt(hold: PromptHold, mode: PromptMode, now: number, held: HeldPrompt): PromptHold {
  if (hold.phase !== PromptPhase.Shown || !Number.isFinite(now)) return hold
  return mode === PromptMode.Press ? COMPLETED_PROMPT : { phase: PromptPhase.Holding, startedAt: now, held }
}

export function releasePrompt(hold: PromptHold, now: number, holdMs: number): PromptHold {
  if (hold.phase !== PromptPhase.Holding) return hold
  return heldLongEnough(hold.startedAt, now, holdMs) ? COMPLETED_PROMPT : CANCELLED_PROMPT
}

export function advancePrompt(hold: PromptHold, now: number, holdMs: number): PromptHold {
  if (hold.phase !== PromptPhase.Holding) return hold
  return heldLongEnough(hold.startedAt, now, holdMs) ? COMPLETED_PROMPT : hold
}

export function cancelPrompt(hold: PromptHold): PromptHold {
  return hold.phase === PromptPhase.Holding ? CANCELLED_PROMPT : hold
}
