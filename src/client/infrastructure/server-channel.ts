import { createFivemClientTransport } from '@openmemorykit/core/client'
import { createClientEvents, type ClientEvents, type RejectionHandler } from '@openmemorykit/core/shared'
import { NET_EVENT_SCHEMAS, NetEvent } from '../../shared/net/net-events'
import type { ServerChannel } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

type NetEvents = ClientEvents<typeof NET_EVENT_SCHEMAS>

export interface ServerLink {
  readonly channel: ServerChannel
  readonly events: NetEvents
}

function guardedListeners(events: NetEvents, onFailure: FailureHandler): NetEvents {
  return {
    emitLocal: (name, payload) => events.emitLocal(name, payload),
    emitToServer: (name, payload) => events.emitToServer(name, payload),
    onLocal: (name, listener) => events.onLocal(name, (payload) => guardedCall(onFailure, `listener of ${name}`, () => listener(payload), undefined)),
    onFromServer: (name, listener) => events.onFromServer(name, (payload) => guardedCall(onFailure, `listener of ${name}`, () => listener(payload), undefined)),
  }
}

export function createServerLink(onRejected: RejectionHandler, onFailure: FailureHandler): ServerLink {
  const transport = createFivemClientTransport(onRejected)
  const events = guardedListeners(createClientEvents(NET_EVENT_SCHEMAS, transport, onRejected), onFailure)
  const channel: ServerChannel = {
    report: (envelope) => {
      guardedCall(onFailure, `emitNet ${NetEvent.Report}`, () => events.emitToServer(NetEvent.Report, envelope), undefined)
    },
  }
  return { channel, events }
}
