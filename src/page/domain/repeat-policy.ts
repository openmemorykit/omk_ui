import { Intent } from '../../protocol/intents'

export const REPEAT_DELAY_MS = 320
export const REPEAT_INTERVAL_MS = 90
export const REPEAT_SAFETY_MS = 10000
export const REPEAT_MAX_PER_CALL = 3

const REPEATABLE_INTENTS: ReadonlySet<Intent> = new Set<Intent>([Intent.Up, Intent.Down, Intent.Left, Intent.Right])

export interface HeldIntent {
  readonly intent: Intent
  readonly pressedAt: number
  readonly nextRepeatAt: number | null
}
export type HeldIntents = readonly HeldIntent[]

export interface DueRepeats {
  readonly held: HeldIntents
  readonly repeats: readonly Intent[]
  readonly stopped: readonly Intent[]
}

export function pressHeld(held: HeldIntents, intent: Intent, now: number): HeldIntents {
  if (!REPEATABLE_INTENTS.has(intent) || !Number.isFinite(now)) return held
  if (held.some((entry) => entry.intent === intent)) return held
  return [...held, { intent, pressedAt: now, nextRepeatAt: now + REPEAT_DELAY_MS }]
}

export function releaseHeld(held: HeldIntents, intent: Intent): HeldIntents {
  return held.some((entry) => entry.intent === intent) ? held.filter((entry) => entry.intent !== intent) : held
}

export function nextRepeatAt(held: HeldIntents): number | null {
  return held.reduce<number | null>((earliest, entry) => {
    if (entry.nextRepeatAt === null) return earliest
    return earliest === null || entry.nextRepeatAt < earliest ? entry.nextRepeatAt : earliest
  }, null)
}

interface Step {
  readonly entry: HeldIntent | null
  readonly repeats: number
}

function stepEntry(entry: HeldIntent, now: number): Step {
  if (entry.nextRepeatAt === null || now < entry.nextRepeatAt) return { entry, repeats: 0 }
  const due = Math.floor((now - entry.nextRepeatAt) / REPEAT_INTERVAL_MS) + 1
  const repeats = Math.min(due, REPEAT_MAX_PER_CALL)
  const next = repeats === due ? entry.nextRepeatAt + due * REPEAT_INTERVAL_MS : now + REPEAT_INTERVAL_MS
  return { entry: { ...entry, nextRepeatAt: next }, repeats }
}

export function dueRepeats(held: HeldIntents, now: number): DueRepeats {
  if (!Number.isFinite(now)) return { held, repeats: [], stopped: [] }
  const kept: HeldIntent[] = []
  const repeats: Intent[] = []
  const stopped: Intent[] = []
  for (const entry of held) {
    if (now - entry.pressedAt >= REPEAT_SAFETY_MS) {
      stopped.push(entry.intent)
      continue
    }
    const step = stepEntry(entry, now)
    for (let count = 0; count < step.repeats; count += 1) repeats.push(entry.intent)
    if (step.entry !== null) kept.push(step.entry)
  }
  return { held: kept, repeats, stopped }
}
