import { hasOwnKey, isRecord, serializedByteLength } from '@openmemorykit/core/shared'
import * as v from 'valibot'
import type { FromPage, FromPageMessageOf } from '../../protocol/from-page'
import { namespaceId } from '../../protocol/namespaced-id'
import { ToPage } from '../../protocol/to-page'
import { JsonObjectSchema, type JsonObject, type JsonValue } from '../../shared/report/json-value'
import { ReportKind } from '../../shared/report/report-kind'
import { SNAPSHOT_MAX_OWNERS, type OwnerUsage } from '../../shared/report/report-payloads'
import { ClientSnapshotField, LastIntentField, ResolutionField } from '../../shared/report/snapshot-fields'
import { radialOrder, visiblePrompt, type RegistryState } from '../domain/owner-registry'
import { decideSessionFocus } from './apply-focus'
import { bindingLabels, currentGlyphSet, requestedLocale } from './boot-message'
import type { ClientPorts } from './ports'
import type { ClientSession, PageLink } from './session-state'
import { updateBookkeeping, type UseCaseContext } from './use-case-context'

export const PAGE_SNAPSHOT_WAIT_MS = 2000
export const SNAPSHOT_REPORT_MAX_BYTES = 8192
const REQUEST_FIELD = 'requestId' satisfies keyof FromPageMessageOf<typeof FromPage.Snapshot>
const SNAPSHOT_FIELD = 'snapshot' satisfies keyof FromPageMessageOf<typeof FromPage.Snapshot>

interface Owned { readonly owner: string }

const countOf = (items: readonly Owned[], owner: string): number => items.filter((item) => item.owner === owner).length

function ownerUsages(registry: RegistryState): readonly OwnerUsage[] {
  const lists = [registry.radialEntries, registry.stack, registry.prompts, registry.confirms]
  const owners = Array.from(new Set(lists.flatMap((items) => items.map(({ owner }) => owner)))).sort()
  return owners.slice(0, SNAPSHOT_MAX_OWNERS).map((owner) => ({
    owner,
    radialEntries: countOf(registry.radialEntries, owner),
    panels: countOf(registry.stack, owner),
    prompts: countOf(registry.prompts, owner),
    confirms: countOf(registry.confirms, owner),
  }))
}

function shownPromptId(registry: RegistryState): string | null {
  const shown = visiblePrompt(registry)
  return shown === null ? null : namespaceId(shown.owner, shown.prompt.id)
}

function lastIntentState({ lastIntent }: PageLink, now: number): JsonValue {
  if (lastIntent === null) return null
  return {
    [LastIntentField.Intent]: lastIntent.intent,
    [LastIntentField.Source]: lastIntent.source,
    [LastIntentField.Seq]: lastIntent.seq,
    [LastIntentField.AgoMs]: now - lastIntent.at,
  }
}

function resolutionState(ports: ClientPorts): JsonValue {
  const { width, height } = ports.game.resolution()
  return { [ResolutionField.Width]: width, [ResolutionField.Height]: height }
}

function clientState(context: UseCaseContext, session: ClientSession): Record<ClientSnapshotField, JsonValue> {
  const { ports } = context
  const { registry, link } = session
  const focus = decideSessionFocus(ports, session)
  const bindings = bindingLabels(ports)
  return {
    [ClientSnapshotField.Locale]: requestedLocale(ports),
    [ClientSnapshotField.Resolution]: resolutionState(ports),
    [ClientSnapshotField.Scale]: ports.config.read().config.theme.scale,
    [ClientSnapshotField.Mode]: session.mode,
    [ClientSnapshotField.Paused]: session.paused,
    [ClientSnapshotField.Modality]: session.modality,
    [ClientSnapshotField.Focus]: focus.focus,
    [ClientSnapshotField.Cursor]: focus.cursor,
    [ClientSnapshotField.KeepInput]: ports.nui.isKeepingInput(),
    [ClientSnapshotField.RadialEntries]: radialOrder(registry).map(({ entry }) => entry.id),
    [ClientSnapshotField.Prompt]: shownPromptId(registry),
    [ClientSnapshotField.NotificationsQueued]: link.queuedNotifications.length,
    [ClientSnapshotField.RadialKey]: bindings.radial,
    [ClientSnapshotField.InteractKey]: bindings.interact,
    [ClientSnapshotField.GlyphSet]: currentGlyphSet(ports),
    [ClientSnapshotField.LastIntent]: lastIntentState(link, ports.clock.now()),
    [ClientSnapshotField.AckSeq]: link.lastAckSeq,
  }
}

function sendSnapshot(context: UseCaseContext, page: JsonObject | null): void {
  const { ports, store } = context
  updateBookkeeping(context, { pendingSnapshot: null })
  const session = store.read()
  const at = ports.clock.now()
  const complete = { client: clientState(context, session), page, owners: [...ownerUsages(session.registry)] }
  const bytes = serializedByteLength({ kind: ReportKind.Snapshot, at, data: complete }) ?? Number.POSITIVE_INFINITY
  ports.server.report({ kind: ReportKind.Snapshot, at, data: bytes > SNAPSHOT_REPORT_MAX_BYTES ? { ...complete, page: null } : complete })
}

export function requestSnapshot(context: UseCaseContext, requestId: number): void {
  if (context.bookkeeping.read().pendingSnapshot !== null) sendSnapshot(context, null)
  if (!context.store.read().link.ready) {
    sendSnapshot(context, null)
    return
  }
  updateBookkeeping(context, { pendingSnapshot: { requestId, requestedAt: context.ports.clock.now() } })
  context.ports.nui.send({ type: ToPage.SnapshotRequest, requestId })
}

function pageState(body: Readonly<Record<string, unknown>>): JsonObject | null {
  const parsed = v.safeParse(JsonObjectSchema, hasOwnKey(body, SNAPSHOT_FIELD) ? body[SNAPSHOT_FIELD] : undefined)
  return parsed.success ? parsed.output : null
}

export function receivePageSnapshot(context: UseCaseContext, body: unknown): void {
  const pending = context.bookkeeping.read().pendingSnapshot
  if (pending === null || !isRecord(body) || !hasOwnKey(body, REQUEST_FIELD) || body[REQUEST_FIELD] !== pending.requestId) return
  sendSnapshot(context, pageState(body))
}

export function expirePageSnapshot(context: UseCaseContext): void {
  const pending = context.bookkeeping.read().pendingSnapshot
  if (pending !== null && context.ports.clock.now() - pending.requestedAt >= PAGE_SNAPSHOT_WAIT_MS) sendSnapshot(context, null)
}
