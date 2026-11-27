import { hasOwnKey, isRecord } from '@openmemorykit/core/shared'
import { CloseReason } from '@openmemorykit/ui/contract'
import type { FromPage } from '../../protocol/from-page'
import { ToPage } from '../../protocol/to-page'
import { ReportKind } from '../../shared/report/report-kind'
import { buildBootMessage } from './boot-message'
import type { RegistryState } from '../domain/owner-registry'
import { deliverReplies, panelClosedReply } from './owner-replies'
import { panelsLostByPage, panelsShownByBoot } from './panels-on-page'
import type { RandomSource } from './ports'
import type { PageLink } from './session-state'
import { ONE_LINE_PER_MINUTE_MS, traceLimited, traceLine } from './trace'
import { rememberLink, type UseCaseContext } from './use-case-context'

export const READY_INTERVAL_MS = 1000
export const SESSION_TOKEN_FIELD = 'sessionToken'
const TOKEN_RADIX = 36
const TOKEN_DRAWS = 3
const TOKEN_SEPARATOR = '.'
const FIRST_READY = 1

function tokenPart(random: RandomSource): string {
  return Math.floor(random.next() * Number.MAX_SAFE_INTEGER).toString(TOKEN_RADIX)
}

function freshToken(random: RandomSource, readyCount: number): string {
  const drawn = Array.from({ length: TOKEN_DRAWS }, () => tokenPart(random))
  return [readyCount.toString(TOKEN_RADIX), ...drawn].join(TOKEN_SEPARATOR)
}

function isTooSoon(link: PageLink, now: number): boolean {
  return link.lastReadyAt !== null && now - link.lastReadyAt < READY_INTERVAL_MS
}

function closePanelsLostByPage(context: UseCaseContext): void {
  const lost = panelsLostByPage(context.memory.read().panelsOnPage, context.store.read().registry)
  deliverReplies(context, [...lost].reverse().map(({ owner, panelId }) => panelClosedReply(owner, panelId, CloseReason.ClosedByOwner)))
}

function bootSeqPassingInFlightCommands(registry: RegistryState, pageWasReady: boolean): number {
  return pageWasReady ? registry.commandSeq + 1 : registry.commandSeq
}

function bootPage(context: UseCaseContext, token: string, readyAt: number): void {
  const { ports, store } = context
  const session = store.read()
  const registry = { ...session.registry, unapplied: [], commandSeq: bootSeqPassingInFlightCommands(session.registry, session.link.ready) }
  const queued = session.link.queuedNotifications
  const link: PageLink = { ...session.link, ready: true, token, lastReadyAt: readyAt, unackedSince: null, lastAckSeq: session.link.intentSeq, queuedNotifications: [] }
  store.write({ ...session, registry, link })
  rememberLink(context, { panelsOnPage: panelsShownByBoot(registry), bootCommandSeq: registry.commandSeq })
  ports.nui.sendBoot(buildBootMessage(ports, registry), token)
  queued.forEach((notification) => ports.nui.send({ type: ToPage.Notify, notification }))
  ports.events.emitReady()
}

function closeLostPanelsThenBoot(context: UseCaseContext, token: string, readyAt: number): void {
  if (context.store.read().link.ready) closePanelsLostByPage(context)
  bootPage(context, token, readyAt)
}

export function receiveReady(context: UseCaseContext): void {
  const { ports, store } = context
  const now = ports.clock.now()
  const { link } = store.read()
  if (isTooSoon(link, now)) return
  const readyCount = context.memory.read().readyCount + 1
  rememberLink(context, { readyCount })
  if (readyCount > FIRST_READY) traceLine(ports, store, { at: now, kind: ReportKind.PageReloaded, data: { readyCount } })
  closeLostPanelsThenBoot(context, freshToken(ports.random, readyCount), now)
}

export function forceBoot(context: UseCaseContext): void {
  const { token, lastReadyAt } = context.store.read().link
  if (token !== null && lastReadyAt !== null) closeLostPanelsThenBoot(context, token, lastReadyAt)
}

function carriesToken(body: unknown, token: string | null): boolean {
  return token !== null && isRecord(body) && hasOwnKey(body, SESSION_TOKEN_FIELD) && body[SESSION_TOKEN_FIELD] === token
}

export function isAuthenticPageCallback(context: UseCaseContext, call: FromPage, body: unknown): boolean {
  const { ports, store } = context
  if (carriesToken(body, store.read().link.token)) return true
  traceLimited(ports, store, { at: ports.clock.now(), kind: ReportKind.ForgedCall, data: { call } }, `${ReportKind.ForgedCall}:${call}`, ONE_LINE_PER_MINUTE_MS)
  return false
}
