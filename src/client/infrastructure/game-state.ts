import type { GameStatePort, ScreenSize } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

const DRIVER_SEAT = -1
const NO_VEHICLE = 0
const UNKNOWN_BUILD = 0
const FALLBACK_RESOLUTION: ScreenSize = Object.freeze({ width: 1920, height: 1080 })

function speedWhenDriving(): number | null {
  const ped = PlayerPedId()
  const vehicle = GetVehiclePedIsIn(ped, false)
  if (vehicle === NO_VEHICLE) return null
  if (GetPedInVehicleSeat(vehicle, DRIVER_SEAT) !== ped) return null
  return GetEntitySpeed(vehicle)
}

function readResolution(): ScreenSize {
  const [width, height] = GetActiveScreenResolution()
  return { width, height }
}

export function createGameStatePort(onFailure: FailureHandler): GameStatePort {
  return {
    isPauseMenuActive: () => guardedCall(onFailure, 'game.isPauseMenuActive', () => IsPauseMenuActive(), false),
    isScreenFaded: () => guardedCall(onFailure, 'game.isScreenFaded', () => IsScreenFadedOut() || IsScreenFadingOut(), false),
    isNuiFocused: () => guardedCall(onFailure, 'game.isNuiFocused', () => IsNuiFocused(), false),
    drivenVehicleSpeed: () => guardedCall(onFailure, 'game.drivenVehicleSpeed', speedWhenDriving, null),
    gameBuild: () => guardedCall(onFailure, 'game.gameBuild', () => GetGameBuildNumber(), UNKNOWN_BUILD),
    resolution: () => guardedCall(onFailure, 'game.resolution', readResolution, FALLBACK_RESOLUTION),
  }
}
