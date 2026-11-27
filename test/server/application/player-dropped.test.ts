import { describe, expect, it } from 'vitest'
import { playerDropped } from '../../../src/server/application/player-dropped'
import { receiveReport } from '../../../src/server/application/receive-report'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { sampleReport } from '../../fixtures/reports'
import { ABSENT_PLAYER, collectReplies, createServerHarness, LOG_PREFIX, OTHER_PLAYER, PLAYER } from './server-harness'

const FLOOD = 60
const BOTH_PLAYERS = 2
const SECOND = 1000

describe('player dropped', () => {
  it('purges the report buckets, so that the Map follows the players who are there', () => {
    const { context } = createServerHarness()
    context.traces.activateAll()
    receiveReport(context, PLAYER, sampleReport(ReportKind.ModeChanged))
    receiveReport(context, OTHER_PLAYER, sampleReport(ReportKind.ModeChanged))
    expect(context.intake.trackedPlayerCount).toBe(BOTH_PLAYERS)
    playerDropped(context, PLAYER)
    expect(context.intake.trackedPlayerCount).toBe(1)
  })

  it('cuts the journal of the player, so that a player who takes his id starts with it cut', () => {
    const { ports, context } = createServerHarness()
    context.traces.activate(PLAYER)
    playerDropped(context, PLAYER)
    ports.players.drop(PLAYER)
    ports.players.join(PLAYER)
    expect(context.traces.isActive(PLAYER)).toBe(false)
    expect(context.traces.trackedCount).toBe(0)
  })

  it('ends the snapshot request of the player with "no answer" right away', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    playerDropped(context, PLAYER)
    expect(replies.lines).toStrictEqual([`${LOG_PREFIX} Pas de réponse de joueur ${PLAYER} sous 3 s`])
    expect(context.snapshots.trackedCount).toBe(0)
  })

  it('does not touch the request of another player', () => {
    const { ports, context } = createServerHarness()
    const replies = collectReplies()
    context.snapshots.open(OTHER_PLAYER, ports.clock.now(), () => ['line'], replies.reply)
    playerDropped(context, PLAYER)
    expect(replies.lines).toStrictEqual([])
    expect(context.snapshots.isPending(OTHER_PLAYER, ports.clock.now())).toBe(true)
  })

  it('writes the reports it ignored from the player before forgetting him, if a second has passed', () => {
    const { ports, context } = createServerHarness()
    for (let sent = 0; sent < FLOOD; sent += 1) receiveReport(context, PLAYER, sampleReport(ReportKind.ModeChanged))
    ports.clock.advance(SECOND)
    playerDropped(context, PLAYER)
    expect(ports.console.lines.at(-1)).toContain('Comptes rendus ignorés : 19')
  })

  it('tolerates a player nobody knew', () => {
    const { ports, context } = createServerHarness()
    playerDropped(context, ABSENT_PLAYER)
    expect(ports.console.lines).toStrictEqual([])
  })
})
