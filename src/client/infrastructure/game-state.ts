import type { GameStatePort, ScreenSize } from '../application/ports'
import { guardNative, type FailureReporter } from './native-guard'

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

export function createGameStatePort(onFailure: FailureReporter): GameStatePort {
  return {
    isPauseMenuActive: () => guardNative(onFailure, 'game.isPauseMenuActive', false, () => IsPauseMenuActive()),
    isScreenFaded: () => guardNative(onFailure, 'game.isScreenFaded', false, () => IsScreenFadedOut() || IsScreenFadingOut()),
    isNuiFocused: () => guardNative(onFailure, 'game.isNuiFocused', false, () => IsNuiFocused()),
    drivenVehicleSpeed: () => guardNative(onFailure, 'game.drivenVehicleSpeed', null, speedWhenDriving),
    gameBuild: () => guardNative(onFailure, 'game.gameBuild', UNKNOWN_BUILD, () => GetGameBuildNumber()),
    resolution: () => guardNative(onFailure, 'game.resolution', FALLBACK_RESOLUTION, readResolution),
  }
}
