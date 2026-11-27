import { ContractErrorCode } from '@openmemorykit/ui/contract'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { LIMITED_TRACE_KEYS_MAX, ONE_LINE_PER_MINUTE_MS, traceLimited, traceLine } from '../../../src/client/application/trace'
import { createSessionStore, INITIAL_CLIENT_SESSION, type SessionStore } from '../../../src/client/application/session-state'
import type { TraceLine } from '../../../src/client/domain/trace-buffer'
import { safeParseReportEnvelope } from '../../../src/shared/report/report-envelope'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { createClientPortsFake } from '../fakes/client-ports-fake'

const LINE_AT = 1200
const TWO_CHANGES = 2
const TWO_KEYS = 2
const FORGED_KEY = 'forged:ready'
const OTHER_KEY = 'forged:event'
const ALMOST_A_MINUTE = ONE_LINE_PER_MINUTE_MS - 1

const FORGED_CALL = 'omk_ui:open'
const forgedCall = (at = LINE_AT): TraceLine => ({ at, kind: ReportKind.ForgedCall, data: { call: FORGED_CALL } })
const callLimited = (at = LINE_AT): TraceLine => ({ at, kind: ReportKind.CallLimited, data: { owner: 'shop', call: FORGED_CALL, code: ContractErrorCode.RateLimited } })
const paused = (value: boolean, at = LINE_AT): TraceLine => ({ at, kind: ReportKind.PagePaused, data: { paused: value } })
const activeStore = (): SessionStore => createSessionStore({ ...INITIAL_CLIENT_SESSION, trace: { ...INITIAL_CLIENT_SESSION.trace, active: true } })
const ringOf = (store: SessionStore): readonly TraceLine[] => store.read().trace.buffer.lines

describe('traceLine', () => {
  it('keeps the line in the ring and sends nothing while the journal is off', () => {
    const ports = createClientPortsFake()
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    traceLine(ports, store, paused(true))
    expect(ringOf(store)).toStrictEqual([paused(true)])
    expect(ports.server.reports).toStrictEqual([])
  })

  it('sends the line to the server as a report while the journal is on', () => {
    const ports = createClientPortsFake()
    const store = activeStore()
    traceLine(ports, store, paused(true))
    expect(ports.server.reports).toStrictEqual([{ kind: ReportKind.PagePaused, at: LINE_AT, data: { paused: true } }])
    expect(ringOf(store)).toHaveLength(1)
  })

  it('sends an envelope that the report schema accepts, and refuses a payload of another kind', () => {
    const ports = createClientPortsFake()
    traceLine(ports, activeStore(), callLimited())
    const [sent] = ports.server.reports
    expect(safeParseReportEnvelope(sent).success).toBe(true)
    const mismatched = { at: LINE_AT, kind: ReportKind.PagePaused, data: { call: FORGED_CALL } }
    expectTypeOf(mismatched).not.toExtend<TraceLine>()
    expect(safeParseReportEnvelope(mismatched).success).toBe(false)
  })

  it('writes one line per change: the same kind and data twice is kept and sent once', () => {
    const ports = createClientPortsFake()
    const store = activeStore()
    traceLine(ports, store, paused(true))
    traceLine(ports, store, paused(true, LINE_AT + 1))
    traceLine(ports, store, paused(false, LINE_AT + TWO_CHANGES))
    expect(ringOf(store).map((line) => line.data)).toStrictEqual([{ paused: true }, { paused: false }])
    expect(ports.server.reports).toHaveLength(TWO_CHANGES)
  })

  it('drops a line the ring refuses, without writing the session', () => {
    const ports = createClientPortsFake()
    const store = activeStore()
    const before = store.read()
    traceLine(ports, store, paused(true, Number.NaN))
    expect(store.read()).toBe(before)
    expect(ports.server.reports).toStrictEqual([])
  })

  it('never lets a failing server channel interrupt the caller, and keeps the line', () => {
    const ports = { ...createClientPortsFake(), server: { report: (): never => { throw new Error('channel down') } } }
    const store = activeStore()
    expect(() => traceLine(ports, store, paused(true))).not.toThrow()
    expect(ringOf(store)).toHaveLength(1)
  })

  it('returns a new session and leaves the previous one untouched', () => {
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    traceLine(createClientPortsFake(), store, paused(true))
    expect(INITIAL_CLIENT_SESSION.trace.buffer.lines).toStrictEqual([])
    expect(store.read()).not.toBe(INITIAL_CLIENT_SESSION)
  })
})

describe('traceLimited', () => {
  it('writes the first line of a key, then nothing more for that key until the interval has passed', () => {
    const ports = createClientPortsFake()
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    traceLimited(ports, store, forgedCall(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    ports.clock.advance(ALMOST_A_MINUTE)
    traceLimited(ports, store, callLimited(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    expect(ringOf(store).map((line) => line.kind)).toStrictEqual([ReportKind.ForgedCall])
    ports.clock.advance(1)
    traceLimited(ports, store, callLimited(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    expect(ringOf(store).map((line) => line.kind)).toStrictEqual([ReportKind.ForgedCall, ReportKind.CallLimited])
  })

  it('limits each key on its own', () => {
    const ports = createClientPortsFake()
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    traceLimited(ports, store, forgedCall(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    traceLimited(ports, store, callLimited(), OTHER_KEY, ONE_LINE_PER_MINUTE_MS)
    expect(ringOf(store)).toHaveLength(TWO_KEYS)
  })

  it('counts the interval from the last line written, not from the last attempt', () => {
    const ports = createClientPortsFake()
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    traceLimited(ports, store, forgedCall(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    ports.clock.advance(ALMOST_A_MINUTE)
    traceLimited(ports, store, callLimited(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    expect(store.read().trace.lastLimitedAt.get(FORGED_KEY)).toBe(0)
  })

  it('sends the limited line while the journal is on', () => {
    const ports = createClientPortsFake()
    traceLimited(ports, activeStore(), forgedCall(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    expect(ports.server.reports.map((report) => report.kind)).toStrictEqual([ReportKind.ForgedCall])
  })

  it(`remembers ${String(LIMITED_TRACE_KEYS_MAX)} keys at most and forgets the oldest first`, () => {
    const ports = createClientPortsFake()
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    const keys = Array.from({ length: LIMITED_TRACE_KEYS_MAX + 1 }, (_unused, index) => `owner-${String(index)}`)
    keys.forEach((key) => traceLimited(ports, store, forgedCall(), key, ONE_LINE_PER_MINUTE_MS))
    const remembered = store.read().trace.lastLimitedAt
    expect(remembered.size).toBe(LIMITED_TRACE_KEYS_MAX)
    expect(remembered.has(keys[0] ?? '')).toBe(false)
    expect(remembered.has(keys[LIMITED_TRACE_KEYS_MAX] ?? '')).toBe(true)
  })

  it('leaves the map of the previous session untouched', () => {
    const store = createSessionStore(INITIAL_CLIENT_SESSION)
    traceLimited(createClientPortsFake(), store, forgedCall(), FORGED_KEY, ONE_LINE_PER_MINUTE_MS)
    expect(INITIAL_CLIENT_SESSION.trace.lastLimitedAt.size).toBe(0)
  })
})
