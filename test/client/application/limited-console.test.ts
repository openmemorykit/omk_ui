import { afterEach, describe, expect, it } from 'vitest'
import { ONCE_PER_KIT_LIFETIME, printLimited } from '../../../src/client/application/limited-console'
import { LIMITED_TRACE_KEYS_MAX, ONE_LINE_PER_MINUTE_MS } from '../../../src/client/application/trace'
import { expectKeepInputNeverTurnedOn, storeWith, watchedPorts } from './watched-ports'

const LINE = 'something happened'
const KEY = 'something'

afterEach(expectKeepInputNeverTurnedOn)

describe('printLimited', () => {
  it('prints the first line for a key', () => {
    const ports = watchedPorts()
    printLimited(ports, storeWith(), KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    expect(ports.console.printed).toStrictEqual([LINE])
  })

  it('prints again only once the interval has passed', () => {
    const ports = watchedPorts()
    const store = storeWith()
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    ports.clock.advance(ONE_LINE_PER_MINUTE_MS - 1)
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    ports.clock.advance(1)
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    expect(ports.console.printed).toStrictEqual([LINE, LINE])
  })

  it('prints a once-per-lifetime line a single time', () => {
    const ports = watchedPorts()
    const store = storeWith()
    printLimited(ports, store, KEY, ONCE_PER_KIT_LIFETIME, LINE)
    ports.clock.advance(Number.MAX_SAFE_INTEGER)
    printLimited(ports, store, KEY, ONCE_PER_KIT_LIFETIME, LINE)
    expect(ports.console.printed).toStrictEqual([LINE])
  })

  it('keeps console keys apart from trace keys and sends nothing to the server', () => {
    const ports = watchedPorts()
    const store = storeWith()
    printLimited(ports, store, KEY, ONE_LINE_PER_MINUTE_MS, LINE)
    expect([...store.read().trace.lastLimitedAt.keys()]).not.toContain(KEY)
    expect(ports.server.reports).toStrictEqual([])
  })

  it('forgets the oldest key beyond the bound', () => {
    const ports = watchedPorts()
    const store = storeWith()
    Array.from({ length: LIMITED_TRACE_KEYS_MAX + 1 }, (_unused, index) => printLimited(ports, store, `key-${index}`, ONCE_PER_KIT_LIFETIME, LINE))
    expect(store.read().trace.lastLimitedAt.size).toBe(LIMITED_TRACE_KEYS_MAX)
    printLimited(ports, store, 'key-0', ONCE_PER_KIT_LIFETIME, LINE)
    expect(ports.console.printed).toHaveLength(LIMITED_TRACE_KEYS_MAX + 1 + 1)
  })
})
