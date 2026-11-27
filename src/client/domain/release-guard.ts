import { isRecord, type ValueOf } from '@openmemorykit/core/shared'

export const RELEASE_GUARD_CAP_MS = 2000
export const VIEW_CONTROL = 0
export const GuardedControl = { FrontendPause: 199, FrontendPauseAlternate: 200, FrontendEscape: 322, FrontendCancel: 202, FrontendBack: 177 } as const
export const PAD_GUARDED_CONTROLS: readonly number[] = Object.freeze(Object.values(GuardedControl))

export const GuardKind = { None: 'none', Pad: 'pad', Escape: 'escape' } as const
export type GuardKind = ValueOf<typeof GuardKind>

export type ReleaseGuard =
  | { readonly kind: typeof GuardKind.None }
  | { readonly kind: typeof GuardKind.Pad; readonly closingControl: number; readonly startedAt: number }
  | { readonly kind: typeof GuardKind.Escape; readonly startedAt: number }

export const GuardSignal = { Frame: 'frame', EscapeReleased: 'escapeReleased', PageBlurred: 'pageBlurred' } as const
export type GuardSignal = ValueOf<typeof GuardSignal>

export type GuardInput =
  | { readonly signal: typeof GuardSignal.Frame; readonly now: number; readonly closingControlHeld: boolean }
  | { readonly signal: typeof GuardSignal.EscapeReleased }
  | { readonly signal: typeof GuardSignal.PageBlurred }

export const GuardEnd = { Released: 'released', EscapeReleased: 'escapeReleased', Blurred: 'blurred', Capped: 'capped' } as const
export type GuardEnd = ValueOf<typeof GuardEnd>

export interface GuardStep {
  readonly guard: ReleaseGuard
  readonly ended: GuardEnd | null
}

export const NO_GUARD: ReleaseGuard = Object.freeze({ kind: GuardKind.None })

const NO_CONTROLS: readonly number[] = Object.freeze([])
const PAD_WITH_VIEW: readonly number[] = Object.freeze([...PAD_GUARDED_CONTROLS, VIEW_CONTROL])

export function startPadGuard(closingControl: number, now: number): ReleaseGuard {
  return Object.freeze({ kind: GuardKind.Pad, closingControl, startedAt: now })
}

export function startEscapeGuard(now: number): ReleaseGuard {
  return Object.freeze({ kind: GuardKind.Escape, startedAt: now })
}

function ending(ended: GuardEnd): GuardStep {
  return Object.freeze({ guard: NO_GUARD, ended })
}

function staying(guard: ReleaseGuard): GuardStep {
  return Object.freeze({ guard, ended: null })
}

function isCapped(startedAt: number, now: number): boolean {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return true
  const elapsed = now - startedAt
  return elapsed < 0 || elapsed >= RELEASE_GUARD_CAP_MS
}

function stepPad(guard: ReleaseGuard & { readonly kind: typeof GuardKind.Pad }, input: GuardInput): GuardStep {
  if (input.signal === GuardSignal.EscapeReleased) return staying(guard)
  if (input.signal === GuardSignal.PageBlurred) return staying(guard)
  if (input.signal !== GuardSignal.Frame) return ending(GuardEnd.Capped)
  if (isCapped(guard.startedAt, input.now)) return ending(GuardEnd.Capped)
  return input.closingControlHeld ? staying(guard) : ending(GuardEnd.Released)
}

function stepEscape(guard: ReleaseGuard & { readonly kind: typeof GuardKind.Escape }, input: GuardInput): GuardStep {
  if (input.signal === GuardSignal.EscapeReleased) return ending(GuardEnd.EscapeReleased)
  if (input.signal === GuardSignal.PageBlurred) return ending(GuardEnd.Blurred)
  if (input.signal !== GuardSignal.Frame) return ending(GuardEnd.Capped)
  return isCapped(guard.startedAt, input.now) ? ending(GuardEnd.Capped) : staying(guard)
}

export function stepReleaseGuard(guard: ReleaseGuard, input: GuardInput): GuardStep {
  if (!isRecord(guard)) return ending(GuardEnd.Capped)
  if (guard.kind === GuardKind.None) return staying(NO_GUARD)
  if (!isRecord(input)) return ending(GuardEnd.Capped)
  if (guard.kind === GuardKind.Pad) return stepPad(guard, input)
  if (guard.kind === GuardKind.Escape) return stepEscape(guard, input)
  return ending(GuardEnd.Capped)
}

export function guardedControls(guard: ReleaseGuard): readonly number[] {
  if (!isRecord(guard)) return NO_CONTROLS
  if (guard.kind !== GuardKind.Pad) return NO_CONTROLS
  return guard.closingControl === VIEW_CONTROL ? PAD_WITH_VIEW : PAD_GUARDED_CONTROLS
}
