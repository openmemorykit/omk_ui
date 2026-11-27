import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import { receiveReport } from '../../../../src/server/application/receive-report'
import { CommandKind } from '../../../../src/shared/net/net-events'
import { ReportKind } from '../../../../src/shared/report/report-kind'
import { SECTION_7_4_CLIENT, SECTION_7_4_LINES, SECTION_7_4_PAGE } from '../../../fixtures/debug-snapshot'
import { PAYLOAD_SAMPLES, REPORT_AT } from '../../../fixtures/reports'
import { AFTER_TIMEOUT_MS, createServerHarness, LOG_PREFIX, OTHER_PLAYER, PLAYER, run } from './command-harness'
import type { ServerHarness } from '../server-harness'

const AFTER_PAGE_LINES = 4
const REQUESTED = `${LOG_PREFIX} Instantané demandé à joueur ${PLAYER}, réponse sous 3 s`

function answer(harness: ServerHarness, client: object, page: object | null): void {
  const data = { ...PAYLOAD_SAMPLES[ReportKind.Snapshot], client, page }
  receiveReport(harness.context, PLAYER, { kind: ReportKind.Snapshot, at: REPORT_AT, data })
}

function lineStarting(lines: readonly string[], start: string): string | undefined {
  return lines.find((line) => line.startsWith(start))
}

function debugRun(harness: ServerHarness, args: string[]): readonly string[] {
  return run(harness, OmkSubcommand.Debug, ...args)
}

describe('omk_ui debug', () => {
  it('asks the client for a snapshot and says so', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    expect(lines).toStrictEqual([REQUESTED])
    expect(harness.ports.clients.sentTo(PLAYER)).toStrictEqual([{ kind: CommandKind.Snapshot, requestId: 1 }])
    expect(harness.context.snapshots.isPending(PLAYER, harness.ports.clock.now())).toBe(true)
  })

  it('writes the state of the client and of the page as in section 7.4, line by line', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, SECTION_7_4_CLIENT, SECTION_7_4_PAGE)
    expect(lines.slice(1)).toStrictEqual(SECTION_7_4_LINES)
  })

  it('writes it in english when the journal is in english', () => {
    const harness = createServerHarness()
    harness.ports.convars.set('omk_ui_locale', 'en')
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, SECTION_7_4_CLIENT, SECTION_7_4_PAGE)
    expect(lineStarting(lines, 'mode')).toBe('mode panels · pause no · modality gamepad · NUI focus yes · cursor no · keepInput no')
    expect(lineStarting(lines, 'held')).toBe('held intents: none · last intent down/pad #212 1.2 s ago · acknowledged #212')
  })

  it('leaves out the form and the keyboard when the page has none', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, SECTION_7_4_CLIENT, { appliedCommandSeq: 0, panels: [] })
    expect(lines.slice(1)).toHaveLength(SECTION_7_4_LINES.length - 1)
    expect(lineStarting(lines, 'pile')).toBe('pile (0, commande 0 appliquée) : aucune')
  })

  it('says the page did not answer, instead of its two lines', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, SECTION_7_4_CLIENT, null)
    expect(lines.slice(1)).toStrictEqual([
      SECTION_7_4_LINES[0],
      SECTION_7_4_LINES[1],
      'page : pas de réponse (pas encore prête)',
      ...SECTION_7_4_LINES.slice(AFTER_PAGE_LINES),
    ])
  })

  it('shows the intent, the prompt and the held intents of a busy client', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    const busy = { ...SECTION_7_4_CLIENT, prompt: 'garage/enter', heldIntents: ['up', 'back'], lastIntent: null }
    answer(harness, busy, SECTION_7_4_PAGE)
    expect(lineStarting(lines, 'invite')).toBe('invite : garage/enter · notifications : 1 visible, 0 en attente')
    expect(lineStarting(lines, 'intentions')).toBe('intentions maintenues : up, back · aucune intention reçue · accusé #212')
  })

  it('writes a question mark for what the client did not say', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, {}, {})
    expect(lines[1]).toBe(`${LOG_PREFIX} joueur ${PLAYER} · kit 1.0.0 · contrat 1 · ? · ?×? · échelle ?`)
    expect(lineStarting(lines, 'mode')).toBe('mode ? · pause ? · modalité ? · focus NUI ? · curseur ? · keepInput ?')
  })

  it('shows what it cannot translate as it came, and reads what it can of a partial snapshot', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    const client = { modality: 'touch', lastIntent: { intent: 'down' }, resolution: { width: 800, height: 600 }, scale: 'big' }
    const page = { panels: [{ id: 'whitelist/list' }, 'junk'], keyboard: {}, form: {} }
    answer(harness, client, page)
    expect(lineStarting(lines, 'mode')).toContain('modalité touch')
    expect(lineStarting(lines, 'intentions')).toBe('intentions maintenues : aucune · dernière intention down/? #? il y a ? s · accusé #?')
    expect(lineStarting(lines, 'pile')).toBe('pile (2, commande ? appliquée) : whitelist/list → ? · sous-panneau ? (?, ?/?)')
    expect(lineStarting(lines, 'formulaire')).toBe('formulaire ? : ? · soumission ? · erreurs ?')
    expect(lines[1]).toContain('800×600 · échelle ?')
  })

  it('joins every panel of the stack with an arrow, not only the first two', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, {}, { appliedCommandSeq: 1, panels: [{ id: 'a/one' }, { id: 'b/two' }, { id: 'c/three' }] })
    expect(lineStarting(lines, 'pile')).toBe('pile (3, commande 1 appliquée) : a/one → b/two → c/three')
  })

  it('prints a forged panel identifier as one neutralised line', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, { modality: 'x\n[omk_ui] fake ^1' }, { appliedCommandSeq: 1, panels: [{ id: 'a\n[omk_ui] fake ^2' }] })
    expect(lines.every((line) => !/[\n\r]|\^\d/.test(line))).toBe(true)
    expect(lineStarting(lines, 'pile')).toContain('a [omk_ui] fake ^ 2')
  })

  it('does not take a field of the wrong type for a number', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    answer(harness, { resolution: { width: '1920', height: 1080 } }, {})
    expect(lines[1]).toContain('?×1080')
  })

  it('says "no answer" when the client keeps silent', () => {
    const harness = createServerHarness()
    const lines = debugRun(harness, [String(PLAYER)])
    harness.ports.clock.advance(AFTER_TIMEOUT_MS)
    receiveReport(harness.context, OTHER_PLAYER, { kind: ReportKind.Snapshot, at: REPORT_AT, data: {} })
    expect(lines.at(-1)).toBe(`${LOG_PREFIX} Pas de réponse de joueur ${PLAYER} sous 3 s`)
  })

  it('names a player who is not there, and shows the usage without an id', () => {
    const harness = createServerHarness()
    expect(debugRun(harness, ['99'])).toStrictEqual([`${LOG_PREFIX} Joueur 99 introuvable`])
    expect(debugRun(harness, [])).toStrictEqual([`${LOG_PREFIX} omk_ui debug <id>`])
    expect(harness.ports.clients.sent).toStrictEqual([])
  })
})
