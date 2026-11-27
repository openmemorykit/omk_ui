import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostWarning, PENDING_PAGE_ERRORS_MAX, SESSION_TOKEN_KEY, WARNING_INTERVAL_MS } from '../../../../src/page/infrastructure/host/fivem-host'
import { ORIGIN_LINE_PREFIX } from '../../../../src/page/infrastructure/host/origin-journal'
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

describe('page errors before the first boot', () => {
  const ERROR = FROM_PAGE_SAMPLES[FromPage.PageError]
  const FIRST = 1
  const SECOND = 2
  const errorNumber = (position: number): FromPageMessage => ({ ...ERROR, message: `startup failure ${String(position)}` })
  const isOriginLine = (body: unknown): boolean => (body as { message: string }).message.startsWith(ORIGIN_LINE_PREFIX)
  const errorsSent = (): readonly unknown[] => harness.calls().filter((call) => call.url === urlOf(FromPage.PageError)).map((call) => call.body).filter((body) => !isOriginLine(body))

  it('keeps a page error raised before boot and posts it with the token when the first boot arrives', () => {
    harness.attach()
    harness.post.mockClear()
    harness.host.send(ERROR)
    expect(harness.post).not.toHaveBeenCalled()
    harness.boot(TOKEN)
    expect(errorsSent()).toEqual([{ ...ERROR, [SESSION_TOKEN_KEY]: TOKEN }])
  })

  it('posts the queued errors once, in order, and not again at the next boot', () => {
    harness.attach()
    harness.post.mockClear()
    harness.host.send(errorNumber(FIRST))
    harness.host.send(errorNumber(SECOND))
    harness.boot(TOKEN)
    harness.boot(NEXT_TOKEN)
    expect(errorsSent().map((body) => (body as { message: string }).message)).toEqual([`startup failure ${String(FIRST)}`, `startup failure ${String(SECOND)}`])
  })

  it('keeps the first errors only, up to a bound, so that a loop cannot fill the memory', () => {
    harness.attach()
    harness.post.mockClear()
    for (let position = 0; position < PENDING_PAGE_ERRORS_MAX + DROPS; position += 1) harness.host.send(errorNumber(position))
    harness.boot(TOKEN)
    const messages = errorsSent().map((body) => (body as { message: string }).message)
    expect(messages).toHaveLength(PENDING_PAGE_ERRORS_MAX)
    expect(messages[0]).toBe('startup failure 0')
  })

  it('warns once when the queue is full, instead of dropping an error without a trace', () => {
    harness.attach()
    for (let position = 0; position < PENDING_PAGE_ERRORS_MAX + DROPS; position += 1) harness.host.send(errorNumber(position))
    expect(harness.warnings.filter((line) => line.includes(HostWarning.PendingDropped))).toHaveLength(1)
  })

  it('does not post a queued error when the boot is refused', () => {
    harness.attach()
    harness.post.mockClear()
    harness.host.send(ERROR)
    harness.boot('')
    expect(errorsSent()).toEqual([])
  })

  it('shows the content of an error queued before boot in the console, because nobody else can read it yet', () => {
    harness.attach()
    harness.host.send(ERROR)
    expect(harness.warnings[0]).toContain(HostWarning.QueuedBeforeBoot)
    expect(harness.warnings[0]).toContain(ERROR.type === FromPage.PageError ? ERROR.message : '')
  })

  it('still drops every other callback before boot', () => {
    harness.attach()
    harness.post.mockClear()
    harness.host.send(EVENT)
    harness.boot(TOKEN)
    expect(harness.calls().filter((call) => call.url === urlOf(FromPage.Event))).toEqual([])
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
