import { createManualClock, type ManualClock } from '@openmemorykit/core/testing'
import type { ServerPorts } from '../../../src/server/application/ports'
import { createConfigSourceFake, type ConfigSourceFake } from '../../shared/fakes/config-source-fake'
import { createConvarSourceFake, type ConvarSourceFake } from '../../shared/fakes/convar-source-fake'
import { createLocaleSourceFake, type LocaleSourceFake } from '../../shared/fakes/locale-source-fake'
import { createClientChannelFake, type ClientChannelFake } from './client-channel-fake'
import { createPlayerPortFake, type PlayerPortFake } from './player-port-fake'
import { createServerConsoleFake, type ServerConsoleFake } from './server-console-fake'

export interface ServerPortsFake extends ServerPorts {
  readonly console: ServerConsoleFake
  readonly clients: ClientChannelFake
  readonly players: PlayerPortFake
  readonly clock: ManualClock
  readonly convars: ConvarSourceFake
  readonly config: ConfigSourceFake
  readonly locales: LocaleSourceFake
}

export function createServerPortsFake(players: readonly number[] = [], startAt = 0): ServerPortsFake {
  return {
    console: createServerConsoleFake(),
    clients: createClientChannelFake(),
    players: createPlayerPortFake(players),
    clock: createManualClock(startAt),
    convars: createConvarSourceFake(),
    config: createConfigSourceFake(),
    locales: createLocaleSourceFake(),
  }
}
