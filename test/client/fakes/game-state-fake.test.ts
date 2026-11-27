import { describe, expect, it } from 'vitest'
import { CALM_SITUATION, createGameStateFake, DEFAULT_GAME_BUILD, FULL_HD } from './game-state-fake'

const SPEED_METERS_PER_SECOND = 12

describe('GameStatePort fake', () => {
  it('starts calm: no pause menu, no fade, no other focus, on foot, full HD', () => {
    const game = createGameStateFake()
    expect([game.isPauseMenuActive(), game.isScreenFaded(), game.isNuiFocused(), game.drivenVehicleSpeed()]).toStrictEqual([false, false, false, null])
    expect(game.gameBuild()).toBe(DEFAULT_GAME_BUILD)
    expect(game.resolution()).toBe(FULL_HD)
  })

  it('changes only what it is told to change', () => {
    const game = createGameStateFake()
    game.setSituation({ pauseMenuActive: true, drivenVehicleSpeed: SPEED_METERS_PER_SECOND })
    expect(game.isPauseMenuActive()).toBe(true)
    expect(game.drivenVehicleSpeed()).toBe(SPEED_METERS_PER_SECOND)
    expect(game.situation).toStrictEqual({ ...CALM_SITUATION, pauseMenuActive: true, drivenVehicleSpeed: SPEED_METERS_PER_SECOND })
    game.setSituation({ screenFaded: true, nuiFocused: true })
    expect([game.isScreenFaded(), game.isNuiFocused()]).toStrictEqual([true, true])
  })
})
