import type { CallResult, Reply } from '@openmemorykit/ui/contract'
import { createFakeClient, type FakeClient } from '../../../preview/runtime/fake-client'
import type { FakeResource, LogEvent } from '../../../preview/runtime/types'
import type { ToPageMessage } from '../../../src/protocol/to-page'
import { createPageDriver, type PageDriver } from './runtime-helpers'

export const Owner = { Whitelist: 'whitelist', Garage: 'garage' } as const

export interface ClientHarness {
  readonly client: FakeClient
  readonly sent: ToPageMessage[]
  readonly events: LogEvent[]
  readonly replies: Map<string, Reply[]>
  readonly resources: Map<string, FakeResource>
  call(owner: string, name: string, ...args: unknown[]): CallResult
  clearSent(): void
}

export function recordReplies(harness: Pick<ClientHarness, 'replies' | 'resources'>, owner: string, onReply: (reply: Reply) => void = () => undefined): void {
  const received: Reply[] = []
  harness.replies.set(owner, received)
  harness.resources.set(owner, {
    call: () => undefined,
    onReply(reply) {
      received.push(reply)
      onReply(reply)
    },
  })
}

export function createClientHarness(send: (message: ToPageMessage) => void = () => undefined, commandSeq?: number): ClientHarness {
  const sent: ToPageMessage[] = []
  const events: LogEvent[] = []
  const replies = new Map<string, Reply[]>()
  const resources = new Map<string, FakeResource>()
  const ports = {
    send: (message: ToPageMessage) => {
      sent.push(message)
      send(message)
    },
    record: (event: LogEvent) => void events.push(event),
    resourceOf: (owner: string) => resources.get(owner),
  }
  const client = commandSeq === undefined ? createFakeClient(ports) : createFakeClient(ports, commandSeq)
  return {
    client,
    sent,
    events,
    replies,
    resources,
    call: (owner, name, ...args) => client.kitFor(owner).call(name, args),
    clearSent: () => void sent.splice(0, sent.length),
  }
}

export interface PageHarness extends ClientHarness { readonly page: PageDriver }

export function createPageHarness(): PageHarness {
  let page: PageDriver | null = null
  const harness = createClientHarness((message) => page?.dispatch(message))
  page = createPageDriver((message) => harness.client.receive(message))
  return { ...harness, page }
}
