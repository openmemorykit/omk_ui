import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import { receiveReport } from '../../../../src/server/application/receive-report'
import { CommandKind } from '../../../../src/shared/net/net-events'
import { ReportKind } from '../../../../src/shared/report/report-kind'
import { PAYLOAD_SAMPLES, REPORT_AT } from '../../../fixtures/reports'
import { AFTER_TIMEOUT_MS, createServerHarness, LOG_PREFIX, PLAYER, run } from './command-harness'

const USAGE = `${LOG_PREFIX} omk_ui owners <id>`
const OWNERS = [
  { owner: 'garage', radialEntries: 1, panels: 2, prompts: 0, confirms: 0 },
  { owner: 'whitelist', radialEntries: 2, panels: 8, prompts: 4, confirms: 1 },
]

describe('omk_ui owners', () => {
  it('goes through the snapshot request, and writes the quotas used by each resource', () => {
    const harness = createServerHarness()
    const lines = run(harness, OmkSubcommand.Owners, String(PLAYER))
    expect(harness.ports.clients.sentTo(PLAYER)).toStrictEqual([{ kind: CommandKind.Snapshot, requestId: 1 }])
    receiveReport(harness.context, PLAYER, { kind: ReportKind.Snapshot, at: REPORT_AT, data: { ...PAYLOAD_SAMPLES[ReportKind.Snapshot], owners: OWNERS } })
    expect(lines).toStrictEqual([
      `${LOG_PREFIX} Instantané demandé à joueur ${PLAYER}, réponse sous 3 s`,
      `${LOG_PREFIX} garage : entrées radiales 1/2 · panneaux 2 · invites 0/4 · confirmations 0/1`,
      'whitelist : entrées radiales 2/2 · panneaux 8 · invites 4/4 · confirmations 1/1',
    ])
  })

  it('says nothing is registered when the client has no owner', () => {
    const harness = createServerHarness()
    const lines = run(harness, OmkSubcommand.Owners, String(PLAYER))
    receiveReport(harness.context, PLAYER, { kind: ReportKind.Snapshot, at: REPORT_AT, data: { ...PAYLOAD_SAMPLES[ReportKind.Snapshot], owners: [] } })
    expect(lines.slice(1)).toStrictEqual([`${LOG_PREFIX} Rien d'enregistré chez joueur ${PLAYER}`])
  })

  it('says "no answer" after 3 seconds', () => {
    const harness = createServerHarness()
    const lines = run(harness, OmkSubcommand.Owners, String(PLAYER))
    harness.ports.clock.advance(AFTER_TIMEOUT_MS)
    run(harness, OmkSubcommand.Version)
    expect(lines).toContain(`${LOG_PREFIX} Pas de réponse de joueur ${PLAYER} sous 3 s`)
  })

  it('names a player who is not there, and shows the usage without an id', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Owners, '99')).toStrictEqual([`${LOG_PREFIX} Joueur 99 introuvable`])
    expect(run(harness, OmkSubcommand.Owners)).toStrictEqual([USAGE])
  })
})
