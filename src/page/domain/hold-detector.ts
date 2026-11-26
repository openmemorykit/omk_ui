export const BACK_HOLD_MS = 600

export interface BackHold {
  readonly pressedAt: number | null
  readonly fired: boolean
}

export const RELEASED_BACK: BackHold = { pressedAt: null, fired: false }

export function pressBack(now: number): BackHold {
  return Number.isFinite(now) ? { pressedAt: now, fired: false } : RELEASED_BACK
}

export function checkBackHold(hold: BackHold, now: number): { readonly hold: BackHold; readonly fired: boolean } {
  if (hold.pressedAt === null || hold.fired || !Number.isFinite(now)) return { hold, fired: false }
  if (now - hold.pressedAt < BACK_HOLD_MS) return { hold, fired: false }
  return { hold: { pressedAt: hold.pressedAt, fired: true }, fired: true }
}
