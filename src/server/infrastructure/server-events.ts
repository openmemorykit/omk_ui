import { createFivemServerTransport } from '@openmemorykit/core/server'
import { createServerEvents, type RejectionHandler, type ServerEvents } from '@openmemorykit/core/shared'
import { NET_EVENT_SCHEMAS } from '../../shared/net/net-events'

export type KitServerEvents = ServerEvents<typeof NET_EVENT_SCHEMAS>

export function createKitServerEvents(onRejected: RejectionHandler): KitServerEvents {
  return createServerEvents(NET_EVENT_SCHEMAS, createFivemServerTransport(), onRejected)
}
