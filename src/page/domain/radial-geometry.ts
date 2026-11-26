import { InputSource } from '../../protocol/intents'
import type { StickEvent } from '../../protocol/intents'

export const RADIAL_DEADZONE = 0.38
export const SUBRING_ENTRY_MAGNITUDE = 0.9
export const CHILD_STEP_DEGREES = 30
export const RADIAL_HOLE_RADIUS = 132
export const RADIAL_RING_OUTER = 318
export const RADIAL_SUBRING_INNER = 330

const FULL_TURN_DEGREES = 360
const SECTOR_HALVES = 2
const HALF_TURN_DEGREES = 180
const BORDER_TOLERANCE_DEGREES = 1e-9
const POINTER_ENTRY_MAGNITUDE = RADIAL_SUBRING_INNER / RADIAL_RING_OUTER

export interface Point {
  readonly x: number
  readonly y: number
}

const STICK_ENTRY_MAGNITUDES: Readonly<Record<InputSource, number>> = {
  [InputSource.Pad]: SUBRING_ENTRY_MAGNITUDE,
  [InputSource.Console]: SUBRING_ENTRY_MAGNITUDE,
  [InputSource.Pointer]: POINTER_ENTRY_MAGNITUDE,
  [InputSource.Keyboard]: Number.POSITIVE_INFINITY,
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isIndex(index: number, count: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < count
}

function magnitudeOf(vector: StickEvent): number | null {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return null
  const magnitude = Math.hypot(vector.x, vector.y)
  return Number.isFinite(magnitude) ? magnitude : null
}

function normalizedDegrees(angle: number): number {
  return ((angle % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES
}

function aimedAngle(vector: StickEvent): number | null {
  const magnitude = magnitudeOf(vector)
  if (magnitude === null || magnitude < RADIAL_DEADZONE) return null
  return normalizedDegrees((Math.atan2(vector.x, -vector.y) * HALF_TURN_DEGREES) / Math.PI)
}

export function sectorCenterAngle(index: number, count: number): number {
  if (!isCount(count) || !Number.isFinite(index)) return 0
  return (index * FULL_TURN_DEGREES) / count
}

export function aimedSector(vector: StickEvent, count: number): number | null {
  const angle = aimedAngle(vector)
  if (angle === null || !isCount(count)) return null
  const sectorSize = FULL_TURN_DEGREES / count
  const shifted = angle + sectorSize / SECTOR_HALVES + BORDER_TOLERANCE_DEGREES
  return Math.floor(shifted / sectorSize) % count
}

export function childCenterAngle(parentIndex: number, parentCount: number, childIndex: number, childCount: number): number {
  if (!isCount(childCount) || !Number.isFinite(childIndex)) return sectorCenterAngle(parentIndex, parentCount)
  return sectorCenterAngle(parentIndex, parentCount) + (childIndex - (childCount - 1) / SECTOR_HALVES) * CHILD_STEP_DEGREES
}

export function aimedChild(vector: StickEvent, parentIndex: number, parentCount: number, childCount: number): number | null {
  const angle = aimedAngle(vector)
  if (angle === null || !isCount(parentCount) || !isIndex(parentIndex, parentCount) || !isCount(childCount)) return null
  const offset = normalizedDegrees(angle - sectorCenterAngle(parentIndex, parentCount) + HALF_TURN_DEGREES) - HALF_TURN_DEGREES
  const child = Math.floor((offset + BORDER_TOLERANCE_DEGREES) / CHILD_STEP_DEGREES + childCount / SECTOR_HALVES)
  return isIndex(child, childCount) ? child : null
}

export function entersSubring(vector: StickEvent, source: InputSource): boolean {
  const magnitude = magnitudeOf(vector)
  return magnitude !== null && magnitude >= STICK_ENTRY_MAGNITUDES[source]
}

export function pointerVector(pointer: Point, center: Point, scale: number): StickEvent | null {
  if (!Number.isFinite(scale) || scale <= 0) return null
  const offsetX = pointer.x - center.x
  const offsetY = pointer.y - center.y
  const distance = Math.hypot(offsetX, offsetY)
  if (!Number.isFinite(distance) || distance < RADIAL_HOLE_RADIUS * scale) return null
  const unit = RADIAL_RING_OUTER * scale
  return { x: offsetX / unit, y: offsetY / unit }
}

export function needleAngle(vector: StickEvent): number | null {
  return aimedAngle(vector)
}
