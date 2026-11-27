import { KitExport } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../src/client/application/contract-call'
import { pumpFrame } from '../../src/client/application/pump-inputs'
import { INITIAL_CLIENT_SESSION } from '../../src/client/application/session-state'
import { receivePageSnapshot, requestSnapshot } from '../../src/client/application/snapshot'
import { PadControl, primePadSnapshot } from '../../src/client/domain/pad-snapshot'
import { transition } from '../../src/page/domain/intent-engine'
import { FromPage } from '../../src/protocol/from-page'
import { Modality } from '../../src/protocol/intents'
import { UiMode } from '../../src/protocol/page-vocabulary'
import { ToPage } from '../../src/protocol/to-page'
import { OmkSubcommand } from '../../src/server/application/omk-subcommand'
import { receiveReport } from '../../src/server/application/receive-report'
import { INPUT_DEFAULTS } from '../../src/shared/config/config-schema'
import { safeParseReportEnvelope } from '../../src/shared/report/report-envelope'
import { ReportKind } from '../../src/shared/report/report-kind'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../fixtures/owned'
import { GARAGE_RADIAL_ENTRY } from '../fixtures/surfaces'
import { NEUTRAL_PAD } from '../client/fakes/controls-fake'
import { createReadyHarness } from '../client/application/use-case-harness'
import { clientIntent, NOW, run, sentOf, withPanels } from '../page/domain/intent-engine/engine-helpers'
import { createServerHarness, PLAYER, run as runCommand } from '../server/application/commands/command-harness'
import { TO_PAGE_SAMPLES } from '../fixtures/messages'
import { Intent } from '../../src/protocol/intents'

const REQUEST_ID = 7
const PAGE_INTENT_SEQ = 5
const UNKNOWN_MARK = '?'
const EMPTY_STACK_LINE = "pile (0,"

function pageSnapshot(): unknown {
  const opened = run(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]), [clientIntent(PAGE_INTENT_SEQ, Intent.Down)]).state
  const answer = transition(opened, { ...TO_PAGE_SAMPLES[ToPage.SnapshotRequest], requestId: REQUEST_ID }, NOW)
  return sentOf(answer.effects, FromPage.Snapshot)[0]?.snapshot
}

function clientReport(page: unknown): unknown {
  const harness = createReadyHarness({ ...INITIAL_CLIENT_SESSION, mode: UiMode.Panels, modality: Modality.Gamepad, pad: primePadSnapshot(NEUTRAL_PAD) })
  handleContractCall(harness.context, KitExport.AddRadialEntry, FixtureOwner.Garage, [GARAGE_RADIAL_ENTRY])
  harness.ports.controls.setUsingKeyboard(false)
  harness.ports.controls.setPad({ ...NEUTRAL_PAD, held: new Set([PadControl.FrontendAccept]) })
  pumpFrame(harness.ports, harness.store, INPUT_DEFAULTS)
  requestSnapshot(harness.context, REQUEST_ID)
  receivePageSnapshot(harness.context, { requestId: REQUEST_ID, snapshot: page })
  return harness.ports.server.reports.find((report) => report.kind === ReportKind.Snapshot)
}

describe('omk_ui debug on a real client and page snapshot', () => {
  it('passes the Snapshot schema', () => {
    const report = clientReport(pageSnapshot())
    expect(safeParseReportEnvelope(report).success).toBe(true)
  })

  it('prints every line without an unknown value and with the open panels', () => {
    const report = clientReport(pageSnapshot())
    const server = createServerHarness()
    const lines = runCommand(server, OmkSubcommand.Debug, String(PLAYER))
    receiveReport(server.context, PLAYER, report)
    expect(lines.filter((line) => line.includes(UNKNOWN_MARK))).toStrictEqual([])
    expect(lines.join('\n')).not.toContain(EMPTY_STACK_LINE)
    expect(lines.some((line) => line.startsWith('pile (2,'))).toBe(true)
    expect(lines.some((line) => line.startsWith('formulaire'))).toBe(true)
    expect(lines.some((line) => line.startsWith('intentions maintenues : down · dernière intention confirm/pad #1 il y a 0,0 s'))).toBe(true)
  })
})
