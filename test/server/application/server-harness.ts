import { SNAPSHOT_TIMEOUT_MS } from '../../../src/server/application/snapshot-requests'
import { createServerContext, type ServerContext } from '../../../src/server/application/server-context'
import english from '../../../omk_ui/locales/en.json'
import french from '../../../omk_ui/locales/fr.json'
import { createServerPortsFake, type ServerPortsFake } from '../fakes/server-ports-fake'

export const KIT_VERSION = '1.0.0'
export const PLAYER = 2
export const OTHER_PLAYER = 5
export const START = 60_000
export const LOG_PREFIX = '[omk_ui]'
export const ABSENT_PLAYER = 99
export const AFTER_TIMEOUT_MS = SNAPSHOT_TIMEOUT_MS + 1
export const ARTIFACT_CONVAR = 'FXServer-master v1.0.0.38435 linux'

export interface ServerHarness {
  readonly ports: ServerPortsFake
  readonly context: ServerContext
}

export function createServerHarness(players: readonly number[] = [PLAYER, OTHER_PLAYER]): ServerHarness {
  const ports = createServerPortsFake(players, START)
  ports.locales.setBundle('fr', { language: 'fr', messages: french })
  ports.locales.setBundle('en', { language: 'en', messages: english })
  ports.convars.set('version', ARTIFACT_CONVAR)
  return { ports, context: createServerContext(ports, KIT_VERSION) }
}

export function collectReplies(): { readonly lines: string[]; readonly reply: (line: string) => void } {
  const lines: string[] = []
  return { lines, reply: (line) => lines.push(line) }
}
