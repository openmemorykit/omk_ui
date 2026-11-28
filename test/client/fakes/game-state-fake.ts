import type { GameStatePort, ScreenSize } from '../../../src/client/application/ports'

export interface GameSituation {
  readonly pauseMenuActive: boolean
  readonly screenFaded: boolean
  readonly nuiFocused: boolean
  readonly drivenVehicleSpeed: number | null
  readonly gameBuild: number
  readonly resolution: ScreenSize
}

export const DEFAULT_GAME_BUILD = 3258
export const FULL_HD: ScreenSize = Object.freeze({ width: 1920, height: 1080 })

export const CALM_SITUATION: GameSituation = Object.freeze({
  pauseMenuActive: false,
  screenFaded: false,
  nuiFocused: false,
  drivenVehicleSpeed: null,
  gameBuild: DEFAULT_GAME_BUILD,
  resolution: FULL_HD,
})

export interface GameStateFake extends GameStatePort {
  readonly situation: GameSituation
  setSituation(change: Partial<GameSituation>): void
}

export function createGameStateFake(initial: GameSituation = CALM_SITUATION): GameStateFake {
  let situation = initial
  return {
    isPauseMenuActive: () => situation.pauseMenuActive,
    isScreenFaded: () => situation.screenFaded,
    isNuiFocused: () => situation.nuiFocused,
    drivenVehicleSpeed: () => situation.drivenVehicleSpeed,
    gameBuild: () => situation.gameBuild,
    resolution: () => situation.resolution,
    setSituation(change) {
      situation = { ...situation, ...change }
    },
    get situation() {
      return situation
    },
  }
}
