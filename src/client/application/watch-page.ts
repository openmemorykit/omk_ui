import { hasOwnKey, isRecord } from '@openmemorykit/core/shared'
import type { FromPage, FromPageMessageOf } from '../../protocol/from-page'
import { UiMode } from '../../protocol/page-vocabulary'
import { isCommandSeq } from '../../protocol/stack'
import { ReportKind } from '../../shared/report/report-kind'
import { FocusReleaseReason, releaseFocus } from './release-focus'
import { endExpiredReservation } from './reservation'
import { expirePageSnapshot } from './snapshot'
import { traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'

export const PAGE_SILENCE_MS = 5000
const ACK_FIELD = 'lastIntentSeq' satisfies keyof FromPageMessageOf<typeof FromPage.Ack>

function acknowledgedSeq(body: unknown): number | null {
  if (!isRecord(body) || !hasOwnKey(body, ACK_FIELD)) return null
  const seq = body[ACK_FIELD]
  return isCommandSeq(seq) ? seq : null
}

export function acknowledgeIntents(context: UseCaseContext, body: unknown): void {
  const seq = acknowledgedSeq(body)
  const session = context.store.read()
  const { link } = session
  if (seq === null || seq > link.intentSeq || seq <= link.lastAckSeq) return
  const unackedSince = seq >= link.intentSeq ? null : context.ports.clock.now()
  context.store.write({ ...session, link: { ...link, lastAckSeq: seq, unackedSince } })
}

function giveUpOnSilentPage(context: UseCaseContext): void {
  const { ports, store } = context
  const session = store.read()
  const { unackedSince, intentSeq, lastAckSeq } = session.link
  if (session.mode === UiMode.Idle || unackedSince === null) return
  const silentMs = ports.clock.now() - unackedSince
  if (silentMs < PAGE_SILENCE_MS) return
  store.write({ ...session, link: { ...session.link, unackedSince: null, lastAckSeq: intentSeq } })
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.PageUnresponsive, data: { silentMs, intentSeq, lastAckSeq } })
  releaseFocus(ports, store, FocusReleaseReason.PageUnresponsive)
}

export function watchPage(context: UseCaseContext): void {
  endExpiredReservation(context)
  expirePageSnapshot(context)
  giveUpOnSilentPage(context)
}
