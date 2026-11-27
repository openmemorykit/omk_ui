import { ContractErrorCode, NOTIFICATIONS_PER_SECOND } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { receiveServerNotification, SERVER_NOTIFICATION_OWNER } from '../../../src/client/application/notify-inbox'
import { ToPage } from '../../../src/protocol/to-page'
import { ReportKind } from '../../../src/shared/report/report-kind'
import { FixtureOwner } from '../../fixtures/owned'
import { KEYED_NOTIFICATION, PLAIN_NOTIFICATION } from '../../fixtures/surfaces'
import { createHarness, createReadyHarness, tracedOfKind } from './use-case-harness'

describe('receiveServerNotification', () => {
  it('sends the notification under the fixed owner omk_ui, its key namespaced', () => {
    const harness = createReadyHarness()
    receiveServerNotification(harness.context, KEYED_NOTIFICATION)
    expect(harness.ports.nui.sentOfType(ToPage.Notify)).toStrictEqual([
      { type: ToPage.Notify, notification: { owner: SERVER_NOTIFICATION_OWNER, notification: { ...KEYED_NOTIFICATION, key: `${SERVER_NOTIFICATION_OWNER}/${KEYED_NOTIFICATION.key}` } } },
    ])
  })

  it('never reads an owner from the payload', () => {
    const harness = createReadyHarness()
    receiveServerNotification(harness.context, { ...PLAIN_NOTIFICATION, owner: FixtureOwner.Whitelist })
    expect(harness.ports.nui.sentOfType(ToPage.Notify)[0]?.notification.owner).toBe(SERVER_NOTIFICATION_OWNER)
  })

  it('validates the notification again and logs a refusal', () => {
    const harness = createReadyHarness()
    receiveServerNotification(harness.context, { ...PLAIN_NOTIFICATION, tone: 'loud' })
    expect(harness.ports.nui.sent).toHaveLength(0)
    expect(tracedOfKind(harness, ReportKind.ContractRefused)[0]?.data.owner).toBe(SERVER_NOTIFICATION_OWNER)
  })

  it('queues it until the page is ready', () => {
    const harness = createHarness()
    receiveServerNotification(harness.context, PLAIN_NOTIFICATION)
    expect(harness.store.read().link.queuedNotifications).toStrictEqual([{ owner: SERVER_NOTIFICATION_OWNER, notification: PLAIN_NOTIFICATION }])
  })

  it('limits a burst of server notifications like any notifying resource', () => {
    const harness = createReadyHarness()
    Array.from({ length: NOTIFICATIONS_PER_SECOND + 1 }, () => receiveServerNotification(harness.context, PLAIN_NOTIFICATION))
    expect(harness.ports.nui.sentOfType(ToPage.Notify)).toHaveLength(NOTIFICATIONS_PER_SECOND)
    expect(tracedOfKind(harness, ReportKind.CallLimited)[0]?.data.code).toBe(ContractErrorCode.RateLimited)
  })
})
