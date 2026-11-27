import { createFivemClientTransport } from '@openmemorykit/core/client'
import { createClientEvents, type ClientEvents, type RejectionHandler } from '@openmemorykit/core/shared'
import { NET_EVENT_SCHEMAS, NetEvent } from '../../shared/net/net-events'
import type { ServerChannel } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

export interface ServerLink {
  readonly channel: ServerChannel
  readonly events: ClientEvents<typeof NET_EVENT_SCHEMAS>
}

export function createServerLink(onRejected: RejectionHandler, onFailure: NativeFailureHandler): ServerLink {
  const transport = createFivemClientTransport(onRejected)
  const events = createClientEvents(NET_EVENT_SCHEMAS, transport, onRejected)
  const channel: ServerChannel = {
    report: (envelope) => {
      guardedNativeCall(onFailure, `emitNet ${NetEvent.Report}`, () => events.emitToServer(NetEvent.Report, envelope), undefined)
    },
  }
  return { channel, events }
}
