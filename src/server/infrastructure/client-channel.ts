import { netEventOf } from '../../shared/net/net-events'
import type { ClientChannel } from '../application/ports'
import { runGuarded, type FailureHandler } from './guarded-call'
import type { KitServerEvents } from './server-events'

export function createClientChannel(events: KitServerEvents, onFailure: FailureHandler): ClientChannel {
  return {
    send(target, command) {
      runGuarded(() => events.emitToClient(target, netEventOf(command), command), onFailure)
    },
  }
}
