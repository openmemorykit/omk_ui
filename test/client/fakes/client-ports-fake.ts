import { createManualClock, type ManualClock } from '@openmemorykit/core/testing'
import type { ClientPorts } from '../../../src/client/application/ports'
import { createConfigSourceFake, type ConfigSourceFake } from '../../shared/fakes/config-source-fake'
import { createConvarSourceFake, type ConvarSourceFake } from '../../shared/fakes/convar-source-fake'
import { createLocaleSourceFake, type LocaleSourceFake } from '../../shared/fakes/locale-source-fake'
import { createCameraFake, type CameraFake } from './camera-fake'
import { createConsoleFake, type ConsoleFake } from './console-fake'
import { createControlsFake, type ControlsFake } from './controls-fake'
import { createGameStateFake, type GameStateFake } from './game-state-fake'
import { createGlyphStoreFake, type GlyphStoreFake } from './glyph-store-fake'
import { createLocalEventsFake, type LocalEventsFake } from './local-events-fake'
import { createLoopFake, type LoopFake } from './loop-fake'
import { createNuiFake, type NuiFake } from './nui-fake'
import { createOwnerReplyFake, type OwnerReplyFake } from './owner-reply-fake'
import { createRandomFake, type RandomFake } from './random-fake'
import { createServerChannelFake, type ServerChannelFake } from './server-channel-fake'

export interface ClientPortsFake extends ClientPorts {
  readonly nui: NuiFake
  readonly controls: ControlsFake
  readonly camera: CameraFake
  readonly game: GameStateFake
  readonly replies: OwnerReplyFake
  readonly pump: LoopFake
  readonly idle: LoopFake
  readonly glyphs: GlyphStoreFake
  readonly config: ConfigSourceFake
  readonly locales: LocaleSourceFake
  readonly convars: ConvarSourceFake
  readonly console: ConsoleFake
  readonly server: ServerChannelFake
  readonly events: LocalEventsFake
  readonly clock: ManualClock
  readonly random: RandomFake
}

export function createClientPortsFake(startAt = 0): ClientPortsFake {
  return {
    nui: createNuiFake(),
    controls: createControlsFake(),
    camera: createCameraFake(),
    game: createGameStateFake(),
    replies: createOwnerReplyFake(),
    pump: createLoopFake(),
    idle: createLoopFake(),
    glyphs: createGlyphStoreFake(),
    config: createConfigSourceFake(),
    locales: createLocaleSourceFake(),
    convars: createConvarSourceFake(),
    console: createConsoleFake(),
    server: createServerChannelFake(),
    events: createLocalEventsFake(),
    clock: createManualClock(startAt),
    random: createRandomFake(),
  }
}
