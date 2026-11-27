import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import { netEventOf } from '../../shared/net/net-events'
import type { ClientChannel } from '../application/ports'
import type { KitServerEvents } from './server-events'

export function createClientChannel(events: KitServerEvents, onFailure: FailureHandler): ClientChannel {
  return {
    send(target, command) {
      const event = netEventOf(command)
      guardedCall(onFailure, `emitNet ${event}`, () => events.emitToClient(target, event, command), undefined)
    },
  }
}
