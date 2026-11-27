import { CallStatus, ContractErrorCode, ContractVersion, KitExport, OpenBlocker, ReplyKind, type ConfirmRequest, type ContractError, type Reply } from '@openmemorykit/ui/contract'
import { AskOutcome } from '../../shared/report/report-payloads'
import { ReportKind } from '../../shared/report/report-kind'
import { handleContractCall } from './contract-call'
import { ASK_OWNER } from './demos/demo-catalog'
import { traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'

const ASK_TITLE_PREFIX = 'omk_ui ask #'
const ASK_CONFIRM_LABEL = 'OK'
const OPEN_BLOCKERS: ReadonlySet<string> = new Set(Object.values(OpenBlocker))

type RefusalReason = OpenBlocker | ContractErrorCode

function askConfirm(askId: number, text: string): ConfirmRequest {
  return { version: ContractVersion.V1, id: String(askId), title: `${ASK_TITLE_PREFIX}${askId}`, text, confirmLabel: ASK_CONFIRM_LABEL }
}

function isOpenBlocker(detail: string | undefined): detail is OpenBlocker {
  return detail !== undefined && OPEN_BLOCKERS.has(detail)
}

function refusalReason(errors: readonly ContractError[]): RefusalReason {
  const [first] = errors
  if (first === undefined) return ContractErrorCode.WrongType
  return first.code === ContractErrorCode.OpenBlocked && isOpenBlocker(first.detail) ? first.detail : first.code
}

function traceAskOutcome(context: UseCaseContext, askId: string, outcome: AskOutcome, reason?: RefusalReason): void {
  const data = reason === undefined ? { askId, outcome } : { askId, outcome, reason }
  traceLine(context.ports, context.store, { at: context.ports.clock.now(), kind: ReportKind.ConfirmAsked, data })
}

export function askQuestion(context: UseCaseContext, askId: number, text: string): void {
  const result = handleContractCall(context, KitExport.Confirm, ASK_OWNER, [askConfirm(askId, text)])
  if (result.status === CallStatus.Refused) traceAskOutcome(context, String(askId), AskOutcome.Refused, refusalReason(result.errors))
}

export function traceAskAnswer(context: UseCaseContext, reply: Reply): void {
  if (reply.kind !== ReplyKind.ConfirmAnswered) return
  traceAskOutcome(context, reply.confirmId, reply.confirmed ? AskOutcome.Confirmed : AskOutcome.Declined)
}
