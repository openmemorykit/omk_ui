import type { GameStatePort, ScreenSize } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

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

export function createGameStatePort(onFailure: NativeFailureHandler): GameStatePort {
  return {
    isPauseMenuActive: () => guardedNativeCall(onFailure, 'game.isPauseMenuActive', () => IsPauseMenuActive(), false),
    isScreenFaded: () => guardedNativeCall(onFailure, 'game.isScreenFaded', () => IsScreenFadedOut() || IsScreenFadingOut(), false),
    isNuiFocused: () => guardedNativeCall(onFailure, 'game.isNuiFocused', () => IsNuiFocused(), false),
    drivenVehicleSpeed: () => guardedNativeCall(onFailure, 'game.drivenVehicleSpeed', speedWhenDriving, null),
    gameBuild: () => guardedNativeCall(onFailure, 'game.gameBuild', () => GetGameBuildNumber(), UNKNOWN_BUILD),
    resolution: () => guardedNativeCall(onFailure, 'game.resolution', readResolution, FALLBACK_RESOLUTION),
  }
}
