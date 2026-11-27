import { describe, expect, it } from 'vitest'
import { flushExpiredSnapshots, receiveReport } from '../../../src/server/application/receive-report'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { sampleReport } from '../../fixtures/reports'
import { ABSENT_PLAYER, AFTER_TIMEOUT_MS, collectReplies, createServerHarness, LOG_PREFIX, OTHER_PLAYER, PLAYER, type ServerHarness } from './server-harness'

const MODE_LINE = `${LOG_PREFIX} 01:00.000 · joueur ${PLAYER} · Mode : from=idle, to=radial`
const BURST = 40
const RATE_PER_SECOND = 20
const SECOND = 1000
const TWO_REPORTS = 2
const TWO_SUMMARIES = 2
const OVER_LIMIT = 3000
const FLOOD = 100

function tracedHarness(): ServerHarness {
  const harness = createServerHarness()
  harness.context.traces.activate(PLAYER)
  return harness
}

function sendMany(harness: ServerHarness, count: number): void {
  for (let sent = 0; sent < count; sent += 1) receiveReport(harness.context, PLAYER, sampleReport(ReportKind.ModeChanged))
}

describe('receive report: who may send', () => {
  it('refuses a report of a player whose journal is cut', () => {
    const { ports, context } = createServerHarness()
    receiveReport(context, PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(ports.console.lines).toStrictEqual([])
  })

  it('refuses it when the journal is on for another player only', () => {
    const { ports, context } = createServerHarness()
    context.traces.activate(OTHER_PLAYER)
    receiveReport(context, PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(ports.console.lines).toStrictEqual([])
  })

  it('writes the line of a player whose journal is on', () => {
    const { ports, context } = tracedHarness()
    receiveReport(context, PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(ports.console.lines).toStrictEqual([MODE_LINE])
  })

  it('writes the line of any player when everyone is traced', () => {
    const { ports, context } = createServerHarness()
    context.traces.activateAll()
    receiveReport(context, OTHER_PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(ports.console.lines).toStrictEqual([MODE_LINE.replace(`joueur ${PLAYER}`, `joueur ${OTHER_PLAYER}`)])
  })

  it('ignores a source that is not a connected player, without remembering it', () => {
    const { ports, context } = createServerHarness()
    context.traces.activateAll()
    receiveReport(context, ABSENT_PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(ports.console.lines).toStrictEqual([])
    expect(context.intake.trackedPlayerCount).toBe(0)
  })

  it('writes every kind of report with the details of its payload', () => {
    const { ports, context } = tracedHarness()
    Object.values(ReportKind)
      .filter((kind) => kind !== ReportKind.Snapshot)
      .forEach((kind) => receiveReport(context, PLAYER, sampleReport(kind)))
    expect(ports.console.lines).toHaveLength(Object.values(ReportKind).length - 1)
    expect(ports.console.lines.join('\n')).toContain('Pile : appliedCommandSeq=3, panels=["whitelist:list"]')
  })
})

describe('receive report: what is refused with a line', () => {
  it('names a report of a wrong shape', () => {
    const { ports, context } = tracedHarness()
    receiveReport(context, PLAYER, { kind: ReportKind.ModeChanged, at: 1, data: {} })
    receiveReport(context, PLAYER, 'text')
    expect(ports.console.lines).toStrictEqual(Array(TWO_REPORTS).fill(`${LOG_PREFIX} 01:00.000 · Compte rendu de joueur ${PLAYER} refusé : forme invalide`))
  })

  it('names a report that is too large', () => {
    const { ports, context } = tracedHarness()
    receiveReport(context, PLAYER, { kind: ReportKind.ConfigApplied, at: 1, data: { gameBuild: 1, locale: 'fr', config: { text: 'x'.repeat(OVER_LIMIT) } } })
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} 01:00.000 · Compte rendu de joueur ${PLAYER} refusé : trop gros`])
  })
})

describe('receive report: snapshot', () => {
  const answer = sampleReport(ReportKind.Snapshot)

  it('is accepted only as the answer to a request in progress, journal cut or not', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    receiveReport(context, PLAYER, answer)
    expect(replies.lines).toStrictEqual([])
    context.snapshots.open(PLAYER, ports.clock.now(), () => ['first', 'second'], replies.reply)
    receiveReport(context, PLAYER, answer)
    expect(replies.lines).toStrictEqual([`${LOG_PREFIX} first`, 'second'])
  })

  it('is answered once only', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    receiveReport(context, PLAYER, answer)
    receiveReport(context, PLAYER, answer)
    expect(replies.lines).toHaveLength(1)
  })

  it('is refused when it was asked of another player', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(OTHER_PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    receiveReport(context, PLAYER, answer)
    expect(replies.lines).toStrictEqual([])
  })

  it('is refused after 3 seconds, and the request ends with "no answer"', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    ports.clock.advance(AFTER_TIMEOUT_MS)
    receiveReport(context, PLAYER, answer)
    expect(replies.lines).toStrictEqual([`${LOG_PREFIX} Pas de réponse de joueur ${PLAYER} sous 3 s`])
  })

  it('stays refused when its shape is wrong, while the request goes on', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    receiveReport(context, PLAYER, { kind: ReportKind.Snapshot, at: 1, data: { client: {} } })
    expect(replies.lines).toStrictEqual([])
    expect(context.snapshots.isPending(PLAYER, ports.clock.now())).toBe(true)
  })
})

describe('receive report: expired snapshot requests', () => {
  it('say "no answer" the next time the server hears of anyone, and only once', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    ports.clock.advance(AFTER_TIMEOUT_MS)
    flushExpiredSnapshots(context)
    flushExpiredSnapshots(context)
    expect(replies.lines).toStrictEqual([`${LOG_PREFIX} Pas de réponse de joueur ${PLAYER} sous 3 s`])
  })
})

describe('receive report: rate limit', () => {
  it('lets a burst of 40 through and refuses the 41st', () => {
    const harness = tracedHarness()
    sendMany(harness, BURST + 1)
    expect(harness.ports.console.lines.filter((line) => line.includes('Mode'))).toHaveLength(BURST)
  })

  it('refills 20 reports per second', () => {
    const harness = tracedHarness()
    sendMany(harness, BURST)
    harness.ports.clock.advance(SECOND)
    sendMany(harness, RATE_PER_SECOND + 1)
    expect(harness.ports.console.lines.filter((line) => line.includes('Mode'))).toHaveLength(BURST + RATE_PER_SECOND)
  })

  it('counts what it ignored and says so once per second at most', () => {
    const harness = tracedHarness()
    sendMany(harness, FLOOD)
    const summaries = (): string[] => harness.ports.console.lines.filter((line) => line.includes('ignorés'))
    expect(summaries()).toStrictEqual([`${LOG_PREFIX} 01:00.000 · joueur ${PLAYER} · Comptes rendus ignorés : 1`])
    harness.ports.clock.advance(SECOND)
    sendMany(harness, 1)
    expect(summaries()).toHaveLength(TWO_SUMMARIES)
    expect(summaries()[1]).toBe(`${LOG_PREFIX} 01:01.000 · joueur ${PLAYER} · Comptes rendus ignorés : ${FLOOD - BURST - 1}`)
    sendMany(harness, 1)
    expect(summaries()).toHaveLength(TWO_SUMMARIES)
  })

  it('limits a flood of reports from a player whose journal is cut as well', () => {
    const { ports, context } = createServerHarness()
    for (let sent = 0; sent < FLOOD; sent += 1) receiveReport(context, PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(ports.console.lines).toHaveLength(1)
    expect(ports.console.lines[0]).toContain('Comptes rendus ignorés')
  })
})
