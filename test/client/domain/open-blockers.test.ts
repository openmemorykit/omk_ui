import { OpenBlocker } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { CLOSE_COOLDOWN_MS, closedByPlayer, firstOpenBlocker, METERS_PER_SECOND_TO_KMH, OPEN_GATE, openConditionsFrom, OpenPurpose, radialOpened, radialSelected, waitingEnded, type OpenConditions } from '../../../src/client/domain/open-blockers'

const LIMIT = 10
const JUST_OVER = 10.1
const BARELY = 0.1
const THREE_MPS = 3
const THREE_MPS_KMH = 10.8
const DRIVING_MPS = 9
const COOLDOWN = 2000
const SHORT_WAIT = 500
const SOON = 5

const NOW = 50_000
const FREE: OpenConditions = Object.freeze({
  pauseMenuActive: false,
  otherNuiFocus: false,
  screenFaded: false,
  driving: false,
  vehicleSpeedMetersPerSecond: 0,
  vehicleSpeedLimitKmh: 10,
  radialEntryCount: 1,
  cooldownUntil: null,
  reservedFor: null,
  caller: 'omk_shop',
  now: NOW,
})
const { RadialGesture, OwnerCall } = OpenPurpose

function with_(overrides: Partial<OpenConditions>): OpenConditions {
  return { ...FREE, ...overrides }
}

describe('open blockers: each reason alone', () => {
  it('lets a free situation through for both purposes', () => {
    expect(firstOpenBlocker(FREE, RadialGesture)).toBeNull()
    expect(firstOpenBlocker(FREE, OwnerCall)).toBeNull()
  })

  it.each([
    [{ pauseMenuActive: true }, OpenBlocker.PauseMenu],
    [{ otherNuiFocus: true }, OpenBlocker.OtherNuiFocus],
    [{ screenFaded: true }, OpenBlocker.ScreenFaded],
    [{ driving: true, vehicleSpeedMetersPerSecond: 5 }, OpenBlocker.VehicleMoving],
  ])('blocks both purposes for %j', (overrides, expected) => {
    expect(firstOpenBlocker(with_(overrides), RadialGesture)).toBe(expected)
    expect(firstOpenBlocker(with_(overrides), OwnerCall)).toBe(expected)
  })

  it('blocks the gesture, not the owner call, without a radial entry', () => {
    expect(firstOpenBlocker(with_({ radialEntryCount: 0 }), RadialGesture)).toBe(OpenBlocker.NoRadialEntry)
    expect(firstOpenBlocker(with_({ radialEntryCount: 0 }), OwnerCall)).toBeNull()
  })

  it('blocks an owner call during the cooldown, never the gesture', () => {
    const cooling = with_({ cooldownUntil: NOW + 1 })
    expect(firstOpenBlocker(cooling, OwnerCall)).toBe(OpenBlocker.Cooldown)
    expect(firstOpenBlocker(cooling, RadialGesture)).toBeNull()
  })

  it('frees the call exactly at cooldownUntil', () => {
    expect(firstOpenBlocker(with_({ cooldownUntil: NOW }), OwnerCall)).toBeNull()
    expect(firstOpenBlocker(with_({ cooldownUntil: NOW + 1 }), OwnerCall)).toBe(OpenBlocker.Cooldown)
  })

  it('reserves for one owner: another is blocked, the chosen one is free, the gesture is untouched', () => {
    const reserved = with_({ reservedFor: 'omk_bank' })
    expect(firstOpenBlocker(reserved, OwnerCall)).toBe(OpenBlocker.Reserved)
    expect(firstOpenBlocker(with_({ reservedFor: 'omk_shop' }), OwnerCall)).toBeNull()
    expect(firstOpenBlocker(with_({ reservedFor: 'omk_bank', caller: null }), OwnerCall)).toBe(OpenBlocker.Reserved)
    expect(firstOpenBlocker(reserved, RadialGesture)).toBeNull()
  })
})

describe('open blockers: order', () => {
  it('returns the first reason of the order when several apply', () => {
    const everything = with_({ pauseMenuActive: true, otherNuiFocus: true, screenFaded: true, driving: true, vehicleSpeedMetersPerSecond: DRIVING_MPS, radialEntryCount: 0, cooldownUntil: NOW + SOON, reservedFor: 'omk_bank' })
    expect(firstOpenBlocker(everything, RadialGesture)).toBe(OpenBlocker.PauseMenu)
    expect(firstOpenBlocker(with_({ ...everything, pauseMenuActive: false }), OwnerCall)).toBe(OpenBlocker.OtherNuiFocus)
    expect(firstOpenBlocker(with_({ ...everything, pauseMenuActive: false, otherNuiFocus: false }), OwnerCall)).toBe(OpenBlocker.ScreenFaded)
    expect(firstOpenBlocker(with_({ ...everything, pauseMenuActive: false, otherNuiFocus: false, screenFaded: false }), OwnerCall)).toBe(OpenBlocker.VehicleMoving)
    expect(firstOpenBlocker(with_({ ...everything, driving: false, pauseMenuActive: false, otherNuiFocus: false, screenFaded: false }), RadialGesture)).toBe(OpenBlocker.NoRadialEntry)
    expect(firstOpenBlocker(with_({ ...everything, driving: false, pauseMenuActive: false, otherNuiFocus: false, screenFaded: false }), OwnerCall)).toBe(OpenBlocker.Cooldown)
    expect(firstOpenBlocker(with_({ cooldownUntil: null, reservedFor: 'omk_bank' }), OwnerCall)).toBe(OpenBlocker.Reserved)
  })
})

describe('open blockers: vehicle', () => {
  const driverAt = (kmh: number, limit = LIMIT): OpenConditions => with_({ driving: true, vehicleSpeedMetersPerSecond: kmh / METERS_PER_SECOND_TO_KMH, vehicleSpeedLimitKmh: limit })

  it('blocks a driver at 10.1 km/h and frees one at 10 km/h', () => {
    expect(firstOpenBlocker(driverAt(JUST_OVER), RadialGesture)).toBe(OpenBlocker.VehicleMoving)
    expect(firstOpenBlocker(driverAt(LIMIT), RadialGesture)).toBeNull()
  })

  it('frees a passenger at any speed', () => {
    expect(firstOpenBlocker(with_({ driving: false, vehicleSpeedMetersPerSecond: 80 }), RadialGesture)).toBeNull()
  })

  it('refuses from 0.1 km/h with a limit of 0', () => {
    expect(firstOpenBlocker(driverAt(BARELY, 0), RadialGesture)).toBe(OpenBlocker.VehicleMoving)
    expect(firstOpenBlocker(driverAt(0, 0), RadialGesture)).toBeNull()
  })

  it('converts 3 m/s to 10.8 km/h', () => {
    expect(THREE_MPS * METERS_PER_SECOND_TO_KMH).toBeCloseTo(THREE_MPS_KMH)
    expect(firstOpenBlocker(with_({ driving: true, vehicleSpeedMetersPerSecond: 3 }), RadialGesture)).toBe(OpenBlocker.VehicleMoving)
    expect(firstOpenBlocker(with_({ driving: true, vehicleSpeedMetersPerSecond: 3, vehicleSpeedLimitKmh: 11 }), RadialGesture)).toBeNull()
  })

  it('fails closed on a speed that is not a number', () => {
    expect(firstOpenBlocker(with_({ driving: true, vehicleSpeedMetersPerSecond: Number.NaN }), RadialGesture)).toBe(OpenBlocker.VehicleMoving)
    expect(firstOpenBlocker(with_({ driving: true, vehicleSpeedLimitKmh: Number.NaN }), RadialGesture)).toBe(OpenBlocker.VehicleMoving)
  })

  it('fails closed on a radial entry count that is not a number', () => {
    expect(firstOpenBlocker(with_({ radialEntryCount: Number.NaN }), RadialGesture)).toBe(OpenBlocker.NoRadialEntry)
  })

  it('fails closed on a clock that is not a number during a cooldown', () => {
    expect(firstOpenBlocker(with_({ cooldownUntil: NOW, now: Number.NaN }), OwnerCall)).toBe(OpenBlocker.Cooldown)
  })
})

describe('open gate', () => {
  it('starts open', () => {
    expect(OPEN_GATE).toEqual({ cooldownUntil: null, reservedFor: null })
  })

  it('sets a 2 second cooldown when the player closes', () => {
    expect(CLOSE_COOLDOWN_MS).toBe(COOLDOWN)
    expect(closedByPlayer(OPEN_GATE, NOW)).toEqual({ cooldownUntil: NOW + COOLDOWN, reservedFor: null })
  })

  it('lifts the cooldown when the radial opens and keeps the reservation', () => {
    const gate = { cooldownUntil: NOW + SHORT_WAIT, reservedFor: 'omk_shop' }
    expect(radialOpened(gate)).toEqual({ cooldownUntil: null, reservedFor: 'omk_shop' })
  })

  it('reserves for the selected owner and lifts it when waiting ends', () => {
    const reserved = radialSelected(OPEN_GATE, 'omk_shop')
    expect(reserved.reservedFor).toBe('omk_shop')
    expect(waitingEnded({ cooldownUntil: NOW, reservedFor: 'omk_shop' })).toEqual({ cooldownUntil: NOW, reservedFor: null })
  })

  it('ignores a clock that is not finite when closing', () => {
    expect(closedByPlayer(OPEN_GATE, Number.NaN)).toBe(OPEN_GATE)
  })

  it('does not mutate a frozen gate', () => {
    const gate = Object.freeze({ cooldownUntil: null, reservedFor: null })
    expect(() => [closedByPlayer(gate, NOW), radialOpened(gate), radialSelected(gate, 'omk_shop'), waitingEnded(gate)]).not.toThrow()
    expect(gate).toEqual({ cooldownUntil: null, reservedFor: null })
  })

  it('builds the conditions from the gate and the situation', () => {
    const { cooldownUntil, reservedFor, ...situation } = FREE
    expect({ cooldownUntil, reservedFor }).toEqual(OPEN_GATE)
    const gate = { cooldownUntil: NOW + 1, reservedFor: 'omk_bank' }
    expect(openConditionsFrom(gate, situation)).toEqual({ ...FREE, ...gate })
    expect(firstOpenBlocker(openConditionsFrom(closedByPlayer(OPEN_GATE, NOW), situation), OwnerCall)).toBe(OpenBlocker.Cooldown)
  })
})
