import { KitExport } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { handleContractCall } from '../../../src/client/application/contract-call'
import { PUSH_TO_TALK_CONVAR } from '../../../src/client/application/apply-focus'
import { expirePageSnapshot, PAGE_SNAPSHOT_WAIT_MS, receivePageSnapshot, requestSnapshot, SNAPSHOT_REPORT_MAX_BYTES } from '../../../src/client/application/snapshot'
import { INITIAL_CLIENT_SESSION } from '../../../src/client/application/session-state'
import { InputSource, Intent } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { ClientSnapshotField, LastIntentField } from '../../../src/shared/report/snapshot-fields'
import { safeParseReportEnvelope } from '../../../src/shared/report/report-envelope'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner } from '../../fixtures/owned'
import { LIST_PANEL } from '../../fixtures/panels'
import { GARAGE_RADIAL_ENTRY, HOLD_PROMPT, REMOVE_CONFIRM } from '../../fixtures/surfaces'
import { SAMPLE_REQUEST_ID } from '../../fixtures/net-commands'
import { createHarness, createReadyHarness, type UseCaseHarness } from './use-case-harness'

const TWO_REPORTS = 2
const SENT_AGO_MS = 1200

const PAGE_STATE = { mode: 'panels', stack: ['whitelist/list'] }
const OTHER_REQUEST_ID = SAMPLE_REQUEST_ID + 1

function snapshots(harness: UseCaseHarness): readonly unknown[] {
  return harness.ports.server.reports.filter((report) => report.kind === ReportKind.Snapshot).map((report) => report.data)
}

function pageAnswers(harness: UseCaseHarness, requestId: number, snapshot: unknown): void {
  receivePageSnapshot(harness.context, { requestId, snapshot })
}

describe('Snapshot', () => {
  it('asks the page, then reports the client state, the page state, the owners and their quotas', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.OpenPanel, FixtureOwner.Whitelist, [LIST_PANEL])
    handleContractCall(harness.context, KitExport.AddRadialEntry, FixtureOwner.Garage, [GARAGE_RADIAL_ENTRY])
    handleContractCall(harness.context, KitExport.ShowPrompt, FixtureOwner.Garage, [HOLD_PROMPT])
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    expect(harness.ports.nui.sentOfType(ToPage.SnapshotRequest)).toStrictEqual([{ type: ToPage.SnapshotRequest, requestId: SAMPLE_REQUEST_ID }])
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    const [report] = harness.ports.server.reports
    expect(report === undefined ? false : safeParseReportEnvelope(report).success).toBe(true)
    expect(snapshots(harness)).toMatchObject([{
      page: PAGE_STATE,
      owners: [{ owner: FixtureOwner.Garage, radialEntries: 1, panels: 0, prompts: 1, confirms: 0 }, { owner: FixtureOwner.Whitelist, radialEntries: 0, panels: 1, prompts: 0, confirms: 0 }],
      client: { radialEntries: [`${FixtureOwner.Garage}/${GARAGE_RADIAL_ENTRY.id}`], prompt: `${FixtureOwner.Garage}/${HOLD_PROMPT.id}`, notificationsQueued: 0, ackSeq: 0 },
    }])
  })

  it('sends the report even with the journal off', () => {
    const harness = createReadyHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    expect(harness.store.read().trace.active).toBe(false)
    expect(snapshots(harness)).toHaveLength(1)
  })

  it('answers at once with no page state when the page is not ready', () => {
    const harness = createHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    expect(snapshots(harness)).toMatchObject([{ page: null }])
    expect(harness.ports.nui.sent).toStrictEqual([])
  })

  it('answers without the page once the page stays silent for 2 s, well under the 3 s of the server', () => {
    const harness = createReadyHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    harness.ports.clock.advance(PAGE_SNAPSHOT_WAIT_MS - 1)
    expirePageSnapshot(harness.context)
    expect(snapshots(harness)).toStrictEqual([])
    harness.ports.clock.advance(1)
    expirePageSnapshot(harness.context)
    expect(snapshots(harness)).toMatchObject([{ page: null }])
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    expect(snapshots(harness)).toHaveLength(1)
  })

  it('ignores a page answer for another request', () => {
    const harness = createReadyHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, OTHER_REQUEST_ID, PAGE_STATE)
    receivePageSnapshot(harness.context, null)
    expect(snapshots(harness)).toStrictEqual([])
  })

  it('reports the client alone when the page state is unreadable or too large', () => {
    const harness = createReadyHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, SAMPLE_REQUEST_ID, ['not', 'an', 'object'])
    requestSnapshot(harness.context, OTHER_REQUEST_ID)
    pageAnswers(harness, OTHER_REQUEST_ID, { filler: 'x'.repeat(SNAPSHOT_REPORT_MAX_BYTES) })
    expect(snapshots(harness)).toMatchObject([{ page: null }, { page: null }])
  })

  it('answers a still pending request before asking again', () => {
    const harness = createReadyHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    requestSnapshot(harness.context, OTHER_REQUEST_ID)
    expect(snapshots(harness)).toMatchObject([{ page: null }])
    pageAnswers(harness, OTHER_REQUEST_ID, PAGE_STATE)
    expect(snapshots(harness)).toHaveLength(TWO_REPORTS)
  })

  it('counts a waiting confirmation in the quotas', () => {
    const harness = createReadyHarness()
    handleContractCall(harness.context, KitExport.Confirm, FixtureOwner.Whitelist, [REMOVE_CONFIRM])
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    expect(snapshots(harness)).toMatchObject([{ owners: [{ owner: FixtureOwner.Whitelist, confirms: 1 }] }])
  })

  it('reads the push-to-talk convar through the real focus decision of the session', () => {
    const harness = createReadyHarness()
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    expect(harness.ports.convars.requested).toContain(PUSH_TO_TALK_CONVAR)
  })

  it('reports the scale of the theme and the last intent the client numbered', () => {
    const harness = createReadyHarness()
    const { link } = harness.store.read()
    harness.store.write({ ...harness.store.read(), link: { ...link, lastIntent: { intent: Intent.Down, source: InputSource.Pad, seq: 3, at: harness.ports.clock.now() - SENT_AGO_MS } } })
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    expect(snapshots(harness)).toMatchObject([{
      client: {
        [ClientSnapshotField.Scale]: 1,
        [ClientSnapshotField.LastIntent]: { [LastIntentField.Intent]: Intent.Down, [LastIntentField.Source]: InputSource.Pad, [LastIntentField.Seq]: 3, [LastIntentField.AgoMs]: SENT_AGO_MS },
      },
    }])
  })

  it('reports no last intent before the client sent one', () => {
    const harness = createReadyHarness(INITIAL_CLIENT_SESSION)
    requestSnapshot(harness.context, SAMPLE_REQUEST_ID)
    pageAnswers(harness, SAMPLE_REQUEST_ID, PAGE_STATE)
    expect(snapshots(harness)).toMatchObject([{ client: { [ClientSnapshotField.LastIntent]: null } }])
  })
})
