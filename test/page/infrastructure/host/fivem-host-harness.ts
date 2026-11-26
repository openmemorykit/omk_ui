import { vi, type Mock } from 'vitest'
import type { HostBridge } from '../../../../src/page/application/ports'
import { createFivemHost, SESSION_TOKEN_KEY } from '../../../../src/page/infrastructure/host/fivem-host'
import { ToPage, type ToPageMessage } from '../../../../src/protocol/to-page'
import { TO_PAGE_SAMPLES } from '../../../fixtures/messages'

export const RESOURCE_NAME = 'omk_ui'
export const TOKEN = 'session-token-1'
export const NEXT_TOKEN = 'session-token-2'
export const START_TIME = 1_000

export interface PostedCall {
  readonly url: string
  readonly method: string | undefined
  readonly body: unknown
}

export interface Harness {
  readonly host: HostBridge
  readonly post: Mock<typeof fetch>
  readonly warnings: string[]
  readonly received: ToPageMessage[]
  readonly time: { now: number }
  attach(): () => void
  deliver(data: unknown): void
  boot(token: unknown): void
  calls(): readonly PostedCall[]
}

export function bootWith(token: unknown): Record<string, unknown> {
  return { ...TO_PAGE_SAMPLES[ToPage.Boot], [SESSION_TOKEN_KEY]: token }
}

function parsedCall([input, init]: Parameters<typeof fetch>): PostedCall {
  const body = init?.body
  return {
    url: typeof input === 'string' ? input : '',
    method: init?.method,
    body: typeof body === 'string' ? JSON.parse(body) : undefined,
  }
}

export function createHarness(): Harness {
  const warnings: string[] = []
  const received: ToPageMessage[] = []
  const time = { now: START_TIME }
  vi.spyOn(window.performance, 'now').mockImplementation(() => time.now)
  const post = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null)))
  const host = createFivemHost(window, RESOURCE_NAME, post, (line) => void warnings.push(line))
  const deliver = (data: unknown): void => void window.dispatchEvent(new MessageEvent('message', { data }))
  return {
    host,
    post,
    warnings,
    received,
    time,
    attach: () => host.listen((message) => void received.push(message)),
    deliver,
    boot: (token) => deliver(bootWith(token)),
    calls: () => post.mock.calls.map(parsedCall),
  }
}
