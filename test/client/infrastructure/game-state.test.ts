import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FailureHandler } from '../../../src/shared/guarded-call'
import { createGameStatePort } from '../../../src/client/infrastructure/game-state'

const PED = 100
const VEHICLE = 200
const OTHER_PED = 300
const DRIVER_SEAT = -1
const SPEED_OVER_TEN_KMH = 4
const BUILD = 3258
const WIDE_SCREEN = { width: 2560, height: 1440 }
const FAILING_PORT_CALLS = 6

let natives: NativeRecorder

function driving(driver: number, speed: number): void {
  natives = installNatives({
    PlayerPedId: () => PED,
    GetVehiclePedIsIn: () => VEHICLE,
    GetPedInVehicleSeat: () => driver,
    GetEntitySpeed: () => speed,
  })
}

afterEach(() => natives.restore())

describe('game state port', () => {
  it('rates a driver above 10 km/h by the speed of the vehicle', () => {
    driving(PED, SPEED_OVER_TEN_KMH)
    expect(createGameStatePort(vi.fn()).drivenVehicleSpeed()).toBe(SPEED_OVER_TEN_KMH)
    expect(natives.callsOf('GetPedInVehicleSeat')).toEqual([[VEHICLE, DRIVER_SEAT]])
    expect(natives.callsOf('GetEntitySpeed')).toEqual([[VEHICLE]])
    expect(natives.callsOf('GetVehiclePedIsIn')).toEqual([[PED, false]])
  })

  it('leaves a passenger free, without reading the vehicle speed', () => {
    driving(OTHER_PED, SPEED_OVER_TEN_KMH)
    expect(createGameStatePort(vi.fn()).drivenVehicleSpeed()).toBeNull()
    expect(natives.callsOf('GetEntitySpeed')).toHaveLength(0)
  })

  it('leaves a player on foot free', () => {
    natives = installNatives({ PlayerPedId: () => PED, GetVehiclePedIsIn: () => 0, GetPedInVehicleSeat: () => PED, GetEntitySpeed: () => 1 })
    expect(createGameStatePort(vi.fn()).drivenVehicleSpeed()).toBeNull()
    expect(natives.callsOf('GetPedInVehicleSeat')).toHaveLength(0)
  })

  it('counts a screen fading out as faded, like one already faded out', () => {
    natives = installNatives({ IsScreenFadedOut: () => false, IsScreenFadingOut: () => true })
    expect(createGameStatePort(vi.fn()).isScreenFaded()).toBe(true)
    natives.restore()
    natives = installNatives({ IsScreenFadedOut: () => true, IsScreenFadingOut: () => false })
    expect(createGameStatePort(vi.fn()).isScreenFaded()).toBe(true)
    natives.restore()
    natives = installNatives({ IsScreenFadedOut: () => false, IsScreenFadingOut: () => false })
    expect(createGameStatePort(vi.fn()).isScreenFaded()).toBe(false)
  })

  it('reads the pause menu, the NUI focus, the build and the screen resolution', () => {
    natives = installNatives({ IsPauseMenuActive: () => true, IsNuiFocused: () => true, GetGameBuildNumber: () => BUILD, GetActiveScreenResolution: () => [WIDE_SCREEN.width, WIDE_SCREEN.height] })
    const game = createGameStatePort(vi.fn())
    expect([game.isPauseMenuActive(), game.isNuiFocused(), game.gameBuild()]).toEqual([true, true, BUILD])
    expect(game.resolution()).toEqual(WIDE_SCREEN)
  })

  it('keeps native failures out of the caller and reports each one', () => {
    const throwing = (): never => { throw new Error('native failed') }
    natives = installNatives({ IsPauseMenuActive: throwing, IsScreenFadedOut: throwing, IsNuiFocused: throwing, PlayerPedId: throwing, GetGameBuildNumber: throwing, GetActiveScreenResolution: throwing })
    const onFailure = vi.fn<FailureHandler>()
    const game = createGameStatePort(onFailure)
    expect([game.isPauseMenuActive(), game.isScreenFaded(), game.isNuiFocused(), game.drivenVehicleSpeed(), game.gameBuild()]).toEqual([false, false, false, null, 0])
    expect(game.resolution()).toEqual({ width: 1920, height: 1080 })
    expect(onFailure).toHaveBeenCalledTimes(FAILING_PORT_CALLS)
  })
})
