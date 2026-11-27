import { hasOwnKey, isRecord, serializedByteLength } from '@openmemorykit/core/shared'
import * as v from 'valibot'
import type { FromPage, FromPageMessageOf } from '../../protocol/from-page'
import { namespaceId } from '../../protocol/namespaced-id'
import { ToPage } from '../../protocol/to-page'
import { JsonObjectSchema, type JsonObject } from '../../shared/report/json-value'
import { ReportKind } from '../../shared/report/report-kind'
import { SNAPSHOT_MAX_OWNERS, type OwnerUsage } from '../../shared/report/report-payloads'
import { decideFocus, PushToTalkPolicy } from '../domain/focus-policy'
import { radialOrder, visiblePrompt, type RegistryState } from '../domain/owner-registry'
import { guardedControls, GuardKind } from '../domain/release-guard'
import { bindingLabels, currentGlyphSet, requestedLocale } from './boot-message'
import type { ClientSession } from './session-state'
import { rememberLink, type UseCaseContext } from './use-case-context'

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

function clientState(context: UseCaseContext, session: ClientSession): JsonObject {
  const { ports } = context
  const { guard, registry, link } = session
  const focus = decideFocus({
    mode: session.mode,
    modality: session.modality,
    paused: session.paused,
    awaitingEscapeRelease: guard.kind === GuardKind.Escape,
    releaseGuardControls: guardedControls(guard),
    textEntryActive: session.textEntry,
    pushToTalk: PushToTalkPolicy.Blocked,
  })
  const bindings = bindingLabels(ports)
  return {
    locale: requestedLocale(ports),
    resolution: { ...ports.game.resolution() },
    mode: session.mode,
    paused: session.paused,
    modality: session.modality,
    focus: focus.focus,
    cursor: focus.cursor,
    keepInput: ports.nui.isKeepingInput(),
    radialEntries: radialOrder(registry).map(({ entry }) => entry.id),
    prompt: shownPromptId(registry),
    notificationsQueued: link.queuedNotifications.length,
    radialKey: bindings.radial,
    interactKey: bindings.interact,
    glyphSet: currentGlyphSet(ports),
    ackSeq: link.lastAckSeq,
  }
}

function sendSnapshot(context: UseCaseContext, page: JsonObject | null): void {
  const { ports, store } = context
  rememberLink(context, { pendingSnapshot: null })
  const session = store.read()
  const at = ports.clock.now()
  const complete = { client: clientState(context, session), page, owners: [...ownerUsages(session.registry)] }
  const bytes = serializedByteLength({ kind: ReportKind.Snapshot, at, data: complete }) ?? Number.POSITIVE_INFINITY
  ports.server.report({ kind: ReportKind.Snapshot, at, data: bytes > SNAPSHOT_REPORT_MAX_BYTES ? { ...complete, page: null } : complete })
}

export function requestSnapshot(context: UseCaseContext, requestId: number): void {
  if (context.memory.read().pendingSnapshot !== null) sendSnapshot(context, null)
  if (!context.store.read().link.ready) {
    sendSnapshot(context, null)
    return
  }
  rememberLink(context, { pendingSnapshot: { requestId, requestedAt: context.ports.clock.now() } })
  context.ports.nui.send({ type: ToPage.SnapshotRequest, requestId })
}

function pageState(body: Readonly<Record<string, unknown>>): JsonObject | null {
  const parsed = v.safeParse(JsonObjectSchema, hasOwnKey(body, SNAPSHOT_FIELD) ? body[SNAPSHOT_FIELD] : undefined)
  return parsed.success ? parsed.output : null
}

export function receivePageSnapshot(context: UseCaseContext, body: unknown): void {
  const pending = context.memory.read().pendingSnapshot
  if (pending === null || !isRecord(body) || !hasOwnKey(body, REQUEST_FIELD) || body[REQUEST_FIELD] !== pending.requestId) return
  sendSnapshot(context, pageState(body))
}

export function expirePageSnapshot(context: UseCaseContext): void {
  const pending = context.memory.read().pendingSnapshot
  if (pending !== null && context.ports.clock.now() - pending.requestedAt >= PAGE_SNAPSHOT_WAIT_MS) sendSnapshot(context, null)
}
