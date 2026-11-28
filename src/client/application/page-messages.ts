import * as v from 'valibot'
import { FromPage } from '../../protocol/from-page'
import { UiMode } from '../../protocol/page-vocabulary'
import { ReportKind } from '../../shared/report/report-kind'
import { applyEscapeReleased } from './apply-escape-released'
import { applyModeChanged, type ModeChange } from './apply-mode-changed'
import { applyPaused } from './apply-paused'
import { applyTextEntry } from './apply-text-entry'
import { bindingLabels } from './boot-message'
import { printLimitedLine } from './limited-console'
import { applyPageEvent } from './page-event'
import { isAuthenticPageCallback, receiveReady } from './page-link'
import { receivePageError } from './receive-page-error'
import { receivePageTrace } from './receive-page-trace'
import { receivePageSnapshot } from './snapshot'
import { ONE_LINE_PER_MINUTE_MS, traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'
import { acknowledgeIntents } from './watch-page'

const ModeChangedBody = v.object({ mode: v.picklist(Object.values(UiMode)), escapeHeld: v.optional(v.literal(true)) })
const PausedBody = v.object({ paused: v.boolean() })
const TextEntryBody = v.object({ active: v.boolean() })
const PAGE_MESSAGES: ReadonlySet<string> = new Set(Object.values(FromPage))

type AuthenticatedMessage = Exclude<FromPage, typeof FromPage.Ready | typeof FromPage.Trace | typeof FromPage.PageError>

function isPageMessage(type: string): type is FromPage {
  return PAGE_MESSAGES.has(type)
}

function readBody<Schema extends v.GenericSchema>(context: UseCaseContext, type: FromPage, schema: Schema, body: unknown): v.InferOutput<Schema> | null {
  const parsed = v.safeParse(schema, body)
  if (parsed.success) return parsed.output
  printLimitedLine(context, type, ONE_LINE_PER_MINUTE_MS, `unreadable page message ${type} ignored`)
  return null
}

function receiveModeChanged(context: UseCaseContext, change: ModeChange): void {
  const { ports, store } = context
  const opening = store.read().mode === UiMode.Idle && change.mode !== UiMode.Idle
  applyModeChanged(ports, store, change)
  if (opening) traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.BindingRead, data: bindingLabels(ports) })
}

function modeChangeOf(body: v.InferOutput<typeof ModeChangedBody>): ModeChange {
  return body.escapeHeld === true ? { mode: body.mode, escapeHeld: true } : { mode: body.mode }
}

function receiveAuthenticMessage(context: UseCaseContext, type: AuthenticatedMessage, body: unknown): void {
  const { ports, store } = context
  switch (type) {
    case FromPage.Event:
      applyPageEvent(context, body)
      return
    case FromPage.Ack:
      acknowledgeIntents(context, body)
      return
    case FromPage.ModeChanged: {
      const read = readBody(context, type, ModeChangedBody, body)
      if (read !== null) receiveModeChanged(context, modeChangeOf(read))
      return
    }
    case FromPage.Paused: {
      const read = readBody(context, type, PausedBody, body)
      if (read !== null) applyPaused(ports, store, read.paused)
      return
    }
    case FromPage.EscapeReleased:
      applyEscapeReleased(ports, store)
      return
    case FromPage.TextEntry: {
      const read = readBody(context, type, TextEntryBody, body)
      if (read !== null) applyTextEntry(ports, store, read.active)
      return
    }
    case FromPage.Snapshot:
      receivePageSnapshot(context, body)
      return
  }
}

export function receivePageMessage(context: UseCaseContext, type: string, body: unknown): void {
  if (!isPageMessage(type)) return
  switch (type) {
    case FromPage.Ready:
      receiveReady(context)
      return
    case FromPage.Trace:
      receivePageTrace(context, body)
      return
    case FromPage.PageError:
      receivePageError(context, body)
      return
    default:
      if (isAuthenticPageCallback(context, type, body)) receiveAuthenticMessage(context, type, body)
  }
}
