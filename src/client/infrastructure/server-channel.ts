import { createFivemClientTransport } from '@openmemorykit/core/client'
import { createClientEvents, type ClientEvents, type RejectionHandler } from '@openmemorykit/core/shared'
import { NET_EVENT_SCHEMAS, NetEvent } from '../../shared/net/net-events'
import type { ServerChannel } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

type NetEvents = ClientEvents<typeof NET_EVENT_SCHEMAS>

export interface ServerLink {
  readonly channel: ServerChannel
  readonly events: NetEvents
}

function guardedListeners(events: NetEvents, onFailure: NativeFailureHandler): NetEvents {
  return {
    emitLocal: (name, payload) => events.emitLocal(name, payload),
    emitToServer: (name, payload) => events.emitToServer(name, payload),
    onLocal: (name, listener) => events.onLocal(name, (payload) => guardedNativeCall(onFailure, `listener of ${name}`, () => listener(payload), undefined)),
    onFromServer: (name, listener) => events.onFromServer(name, (payload) => guardedNativeCall(onFailure, `listener of ${name}`, () => listener(payload), undefined)),
  }
}

export function createServerLink(onRejected: RejectionHandler, onFailure: NativeFailureHandler): ServerLink {
  const transport = createFivemClientTransport(onRejected)
  const events = guardedListeners(createClientEvents(NET_EVENT_SCHEMAS, transport, onRejected), onFailure)
  const channel: ServerChannel = {
    report: (envelope) => {
      guardedNativeCall(onFailure, `emitNet ${NetEvent.Report}`, () => events.emitToServer(NetEvent.Report, envelope), undefined)
    },
  }
  return { channel, events }
}
