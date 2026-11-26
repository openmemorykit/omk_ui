import { OpenBlocker } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'

export const METERS_PER_SECOND_TO_KMH = 3.6
export const CLOSE_COOLDOWN_MS = 2000
export const OpenPurpose = { RadialGesture: 'radialGesture', OwnerCall: 'ownerCall' } as const
export type OpenPurpose = ValueOf<typeof OpenPurpose>

export interface OpenConditions {
  readonly pauseMenuActive: boolean
  readonly otherNuiFocus: boolean
  readonly screenFaded: boolean
  readonly driving: boolean
  readonly vehicleSpeedMetersPerSecond: number
  readonly vehicleSpeedLimitKmh: number
  readonly radialEntryCount: number
  readonly cooldownUntil: number | null
  readonly reservedFor: string | null
  readonly caller: string | null
  readonly now: number
}

export interface OpenGate {
  readonly cooldownUntil: number | null
  readonly reservedFor: string | null
}

export const OPEN_GATE: OpenGate = Object.freeze({ cooldownUntil: null, reservedFor: null })

function movingTooFast(conditions: OpenConditions): boolean {
  if (!conditions.driving) return false
  const speedKmh = conditions.vehicleSpeedMetersPerSecond * METERS_PER_SECOND_TO_KMH
  return !(speedKmh <= conditions.vehicleSpeedLimitKmh)
}

function coolingDown(conditions: OpenConditions): boolean {
  return conditions.cooldownUntil !== null && !(conditions.now >= conditions.cooldownUntil)
}

function reservedForAnother(conditions: OpenConditions): boolean {
  return conditions.reservedFor !== null && conditions.caller !== conditions.reservedFor
}

interface BlockerRule {
  readonly blocker: OpenBlocker
  readonly purpose: OpenPurpose | null
  readonly applies: (conditions: OpenConditions) => boolean
}

const BLOCKER_RULES: readonly BlockerRule[] = Object.freeze([
  { blocker: OpenBlocker.PauseMenu, purpose: null, applies: (conditions) => conditions.pauseMenuActive },
  { blocker: OpenBlocker.OtherNuiFocus, purpose: null, applies: (conditions) => conditions.otherNuiFocus },
  { blocker: OpenBlocker.ScreenFaded, purpose: null, applies: (conditions) => conditions.screenFaded },
  { blocker: OpenBlocker.VehicleMoving, purpose: null, applies: movingTooFast },
  { blocker: OpenBlocker.NoRadialEntry, purpose: OpenPurpose.RadialGesture, applies: (conditions) => !(conditions.radialEntryCount > 0) },
  { blocker: OpenBlocker.Cooldown, purpose: OpenPurpose.OwnerCall, applies: coolingDown },
  { blocker: OpenBlocker.Reserved, purpose: OpenPurpose.OwnerCall, applies: reservedForAnother },
])

export function firstOpenBlocker(conditions: OpenConditions, purpose: OpenPurpose): OpenBlocker | null {
  const rule = BLOCKER_RULES.find((candidate) => (candidate.purpose === null || candidate.purpose === purpose) && candidate.applies(conditions))
  return rule === undefined ? null : rule.blocker
}

export function openConditionsFrom(gate: OpenGate, situation: Omit<OpenConditions, keyof OpenGate>): OpenConditions {
  return { ...situation, cooldownUntil: gate.cooldownUntil, reservedFor: gate.reservedFor }
}

export function closedByPlayer(gate: OpenGate, now: number): OpenGate {
  return Number.isFinite(now) ? { ...gate, cooldownUntil: now + CLOSE_COOLDOWN_MS } : gate
}

export function radialOpened(gate: OpenGate): OpenGate {
  return { ...gate, cooldownUntil: null }
}

export function radialSelected(gate: OpenGate, owner: string): OpenGate {
  return { ...gate, reservedFor: owner }
}

export function waitingEnded(gate: OpenGate): OpenGate {
  return { ...gate, reservedFor: null }
}
