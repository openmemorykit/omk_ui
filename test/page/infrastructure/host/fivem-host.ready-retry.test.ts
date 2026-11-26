import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FromPage } from '../../../../src/protocol/from-page'
import { READY_MAX_RETRIES, READY_RETRY_DELAY_MS } from '../../../../src/page/infrastructure/host/fivem-host'
import { createHarness, TOKEN, type Harness } from './fivem-host-harness'

const READY_URL = `https://omk_ui/${FromPage.Ready}`
const SETTLE_TICKS = 5
const EXTRA_ROUNDS = 3
const SECOND_POST = 2
const FEW_RETRIES = 3

let harness: Harness

async function settle(): Promise<void> {
  for (let tick = 0; tick < SETTLE_TICKS; tick += 1) await Promise.resolve()
}

async function elapse(delayMs: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(delayMs)
  await settle()
}

function readyPosts(): number {
  return harness.calls().filter((call) => call.url === READY_URL).length
}

beforeEach(() => {
  vi.useFakeTimers()
  harness = createHarness()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ready retry', () => {
  it('posts ready again after a rejected post, after the retry delay', async () => {
    harness.post.mockImplementation(() => Promise.reject(new Error('offline')))
    harness.attach()
    await settle()
    expect(readyPosts()).toBe(1)
    await elapse(READY_RETRY_DELAY_MS - 1)
    expect(readyPosts()).toBe(1)
    await elapse(1)
    expect(readyPosts()).toBe(SECOND_POST)
  })

  it('retries when the callback answers with an error status', async () => {
    harness.post.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
    harness.attach()
    await settle()
    await elapse(READY_RETRY_DELAY_MS)
    expect(readyPosts()).toBe(SECOND_POST)
  })

  it('stops after the bounded number of retries', async () => {
    harness.post.mockImplementation(() => Promise.reject(new Error('offline')))
    harness.attach()
    await settle()
    for (let round = 0; round < READY_MAX_RETRIES + EXTRA_ROUNDS; round += 1) await elapse(READY_RETRY_DELAY_MS)
    expect(readyPosts()).toBe(READY_MAX_RETRIES + 1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not retry a ready that succeeded', async () => {
    harness.attach()
    await settle()
    await elapse(READY_RETRY_DELAY_MS * FEW_RETRIES)
    expect(readyPosts()).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops retrying once a boot was accepted', async () => {
    harness.post.mockImplementation(() => Promise.reject(new Error('offline')))
    harness.attach()
    await settle()
    harness.boot(TOKEN)
    await elapse(READY_RETRY_DELAY_MS * FEW_RETRIES)
    expect(readyPosts()).toBe(1)
  })

  it('stops retrying once every listener left', async () => {
    harness.post.mockImplementation(() => Promise.reject(new Error('offline')))
    const stop = harness.attach()
    await settle()
    stop()
    await elapse(READY_RETRY_DELAY_MS * FEW_RETRIES)
    expect(readyPosts()).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never retries a callback other than ready', async () => {
    harness.attach()
    harness.boot(TOKEN)
    harness.post.mockClear()
    harness.post.mockImplementation(() => Promise.reject(new Error('offline')))
    harness.host.send({ type: FromPage.EscapeReleased })
    await settle()
    await elapse(READY_RETRY_DELAY_MS * FEW_RETRIES)
    expect(harness.calls().filter((call) => call.url !== READY_URL)).toHaveLength(1)
  })
})
