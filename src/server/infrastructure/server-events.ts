import { createFivemServerTransport } from '@openmemorykit/core/server'
import { createServerEvents, type ServerEvents } from '@openmemorykit/core/shared'
import { SERVER_EVENT_SCHEMAS } from '../../shared/net/net-events'

export type KitServerEvents = ServerEvents<typeof SERVER_EVENT_SCHEMAS>

const REJECTION_HANDLER_NEVER_CALLED = (): void => undefined

export function createKitServerEvents(): KitServerEvents {
  return createServerEvents(SERVER_EVENT_SCHEMAS, createFivemServerTransport(), REJECTION_HANDLER_NEVER_CALLED)
}
