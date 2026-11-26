import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostWarning, SESSION_TOKEN_KEY, WARNING_INTERVAL_MS } from '../../../../src/page/infrastructure/host/fivem-host'
import { FromPage, type FromPageMessage } from '../../../../src/protocol/from-page'
import { ReportKind } from '../../../../src/shared/report/report-kind'
import { FROM_PAGE_SAMPLES } from '../../../fixtures/messages'
import { createHarness, NEXT_TOKEN, RESOURCE_NAME, TOKEN, type Harness } from './fivem-host-harness'

const REJECTIONS = 10
const DROPS = 5
const TWO_LINES = 2
const POST_METHOD = 'POST'
const READY_URL = `https://${RESOURCE_NAME}/${FromPage.Ready}`
const EVENT = FROM_PAGE_SAMPLES[FromPage.Event]
const TOKENED_TYPES = Object.values(FromPage).filter((type) => type !== FromPage.Ready)
const urlOf = (type: string): string => `https://${RESOURCE_NAME}/${type}`

let harness: Harness

beforeEach(() => {
  harness = createHarness()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function booted(): void {
  harness.attach()
  harness.boot(TOKEN)
  harness.post.mockClear()
}

describe('ready', () => {
  it('posts ready without token when the first listener attaches', () => {
    expect(harness.post).not.toHaveBeenCalled()
    harness.attach()
    expect(harness.calls()).toEqual([{ url: READY_URL, method: POST_METHOD, body: { type: FromPage.Ready } }])
  })

  it('does not post ready again for a second listener, but does after a full detach', () => {
    const stop = harness.attach()
    harness.host.listen(() => undefined)()
    stop()
    harness.attach()
    expect(harness.calls().map((call) => call.url)).toEqual([READY_URL, READY_URL])
  })

  it('posts a ready sent by the page without token, even before boot', () => {
    harness.host.send(FROM_PAGE_SAMPLES[FromPage.Ready])
    expect(harness.calls()).toEqual([{ url: READY_URL, method: POST_METHOD, body: { type: FromPage.Ready } }])
  })

  it('never joins the token to ready', () => {
    booted()
    harness.host.send(FROM_PAGE_SAMPLES[FromPage.Ready])
    expect(harness.calls()).toEqual([{ url: READY_URL, method: POST_METHOD, body: { type: FromPage.Ready } }])
  })
})

describe('callbacks with token', () => {
  it.each(TOKENED_TYPES)('posts %s to its callback with the session token in the JSON body', (type) => {
    booted()
    harness.host.send(FROM_PAGE_SAMPLES[type])
    expect(harness.calls()).toEqual([{ url: urlOf(type), method: POST_METHOD, body: { ...FROM_PAGE_SAMPLES[type], [SESSION_TOKEN_KEY]: TOKEN } }])
    expect(harness.post.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json; charset=UTF-8' })
  })

  it('uses the token of the latest boot', () => {
    booted()
    harness.boot(NEXT_TOKEN)
    harness.host.send(EVENT)
    expect(harness.calls()[0]?.body).toEqual({ ...EVENT, [SESSION_TOKEN_KEY]: NEXT_TOKEN })
  })

  it('keeps the current token when a later boot is refused', () => {
    booted()
    harness.boot('')
    harness.host.send(EVENT)
    expect(harness.calls()[0]?.body).toEqual({ ...EVENT, [SESSION_TOKEN_KEY]: TOKEN })
  })

  it('drops callbacks before any boot, with one warning line per minute at most', () => {
    harness.attach()
    harness.post.mockClear()
    for (let drop = 0; drop < DROPS; drop += 1) harness.host.send(EVENT)
    expect(harness.post).not.toHaveBeenCalled()
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain(HostWarning.SendWithoutToken)
    harness.time.now += WARNING_INTERVAL_MS
    harness.host.send(EVENT)
    expect(harness.warnings).toHaveLength(TWO_LINES)
    expect(harness.warnings[1]).toContain(String(DROPS - 1))
  })

  it('refuses a message whose type is not a callback', () => {
    booted()
    harness.host.send({ type: 'toString' } as unknown as FromPageMessage)
    expect(harness.post).not.toHaveBeenCalled()
    expect(harness.warnings[0]).toContain(HostWarning.UnknownCallback)
  })
})

describe('failed callbacks', () => {
  it('catches rejected fetches, with one bounded warning line', async () => {
    booted()
    harness.post.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    for (let rejection = 0; rejection < REJECTIONS; rejection += 1) harness.host.send(EVENT)
    await flushPromises()
    expect(harness.warnings).toHaveLength(1)
    expect(harness.warnings[0]).toContain(HostWarning.CallbackFailed)
    harness.time.now += WARNING_INTERVAL_MS
    harness.host.send(EVENT)
    await flushPromises()
    expect(harness.warnings).toHaveLength(TWO_LINES)
    expect(harness.warnings[1]).toContain(String(REJECTIONS - 1))
  })

  it('catches a fetch that throws synchronously', () => {
    booted()
    harness.post.mockImplementation(() => {
      throw new TypeError('Invalid URL')
    })
    expect(() => harness.host.send(EVENT)).not.toThrow()
    expect(harness.warnings[0]).toContain(HostWarning.CallbackFailed)
  })

  it('catches a body that cannot be serialised', () => {
    booted()
    const unserialisable = { type: FromPage.Trace, kind: ReportKind.ModeChanged, data: { size: BigInt(1) } } as unknown as FromPageMessage
    expect(() => harness.host.send(unserialisable)).not.toThrow()
    expect(harness.post).not.toHaveBeenCalled()
    expect(harness.warnings[0]).toContain(HostWarning.CallbackFailed)
  })

  it('survives a warn function that throws', async () => {
    harness = createHarnessWithThrowingWarn()
    harness.post.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(() => harness.attach()).not.toThrow()
    expect(() => harness.host.send(EVENT)).not.toThrow()
    await flushPromises()
  })
})

function createHarnessWithThrowingWarn(): Harness {
  const base = createHarness()
  base.warnings.push = () => {
    throw new Error('console gone')
  }
  return base
}
