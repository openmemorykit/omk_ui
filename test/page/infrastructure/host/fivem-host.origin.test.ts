import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_TOKEN_KEY } from '../../../../src/page/infrastructure/host/fivem-host'
import { ORIGIN_JOURNAL_MAX } from '../../../../src/page/infrastructure/host/origin-journal'
import { FromPage } from '../../../../src/protocol/from-page'
import { ToPage } from '../../../../src/protocol/to-page'
import { TO_PAGE_SAMPLES } from '../../../fixtures/messages'
import { bootWith, createHarness, RESOURCE_NAME, TOKEN, type Harness } from './fivem-host-harness'

const OWN_ORIGIN = 'https://cfx-nui-omk_ui'
const OTHER_ORIGIN = 'https://elsewhere.example'
const PAGE_ERROR_URL = `https://${RESOURCE_NAME}/${FromPage.PageError}`
const STRANGER = {} as MessageEventSource
const LONG_ORIGIN = 1_000
const LINE_LIMIT = 300
const EXTRA_ORIGINS = 5

let harness: Harness

beforeEach(() => {
  harness = createHarness()
  harness.attach()
  harness.post.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function arrive(init: MessageEventInit, data: unknown = { type: ToPage.Modality, modality: 'gamepad' }): void {
  window.dispatchEvent(new MessageEvent('message', { data, ...init }))
}

function bootFromOwnOrigin(): void {
  arrive({ origin: OWN_ORIGIN, source: window }, bootWith(TOKEN))
}

function journal(): readonly string[] {
  return harness.calls().filter((call) => call.url === PAGE_ERROR_URL).map((call) => (call.body as { message: string }).message)
}

describe('journal of the origin of the incoming messages (D6)', () => {
  it('records the origin and the source of the first message, in the queue that waits for the boot', () => {
    arrive({ origin: OWN_ORIGIN, source: window })
    expect(harness.post).not.toHaveBeenCalled()
    bootFromOwnOrigin()
    expect(journal()).toEqual([`message origin ${OWN_ORIGIN}, source self`])
    expect(harness.calls().find((call) => call.url === PAGE_ERROR_URL)?.body).toMatchObject({ type: FromPage.PageError, stack: '', [SESSION_TOKEN_KEY]: TOKEN })
  })

  it('records an origin once, and a new origin or a new source as a new line', () => {
    bootFromOwnOrigin()
    harness.post.mockClear()
    arrive({ origin: OWN_ORIGIN, source: window })
    arrive({ origin: OTHER_ORIGIN, source: window })
    arrive({ origin: OTHER_ORIGIN, source: window })
    arrive({ origin: OWN_ORIGIN, source: null })
    arrive({ origin: OWN_ORIGIN, source: STRANGER })
    expect(journal()).toEqual([
      `message origin ${OTHER_ORIGIN}, source self`,
      `message origin ${OWN_ORIGIN}, source none`,
      `message origin ${OWN_ORIGIN}, source other`,
    ])
  })

  it('filters nothing: a message from a foreign origin still reaches the page', () => {
    arrive({ origin: OTHER_ORIGIN, source: STRANGER }, TO_PAGE_SAMPLES[ToPage.Modality])
    expect(harness.received).toEqual([TO_PAGE_SAMPLES[ToPage.Modality]])
  })

  it('records the origin of a message the page cannot read as well', () => {
    bootFromOwnOrigin()
    harness.post.mockClear()
    arrive({ origin: OTHER_ORIGIN, source: STRANGER }, 'not an object')
    expect(journal()).toEqual([`message origin ${OTHER_ORIGIN}, source other`])
  })

  it('writes a missing origin as unknown and cuts a long one', () => {
    bootFromOwnOrigin()
    harness.post.mockClear()
    arrive({ origin: '', source: window })
    arrive({ origin: `https://${'a'.repeat(LONG_ORIGIN)}`, source: window })
    expect(journal()[0]).toBe('message origin unknown, source self')
    expect(journal()[1]?.length).toBeLessThan(LINE_LIMIT)
  })

  it('stops after a bounded number of lines so that a hostile window cannot flood the journal', () => {
    bootFromOwnOrigin()
    harness.post.mockClear()
    for (let position = 0; position < ORIGIN_JOURNAL_MAX + EXTRA_ORIGINS; position += 1) arrive({ origin: `https://origin-${String(position)}.example`, source: window })
    expect(journal()).toHaveLength(ORIGIN_JOURNAL_MAX - 1)
  })
})
