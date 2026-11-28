import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import { netEventOf } from '../../shared/net/net-events'
import type { ClientChannel } from '../application/ports'
import type { KitServerEvents } from './server-events'

export function createClientChannel(events: KitServerEvents, onFailure: FailureHandler): ClientChannel {
  return {
    send(target, command) {
      const event = guardedCall(onFailure, 'name the net event of a command', () => netEventOf(command), null)
      if (event === null) return
      guardedCall(onFailure, `emitNet ${event}`, () => events.emitToClient(target, event, command), undefined)
    },
  }
}
