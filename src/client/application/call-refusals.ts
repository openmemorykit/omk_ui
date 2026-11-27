import { ContractErrorCode, MAX_REPORTED_ERRORS, refusedCall, type CallResult, type ContractError, type KitExport, type OpenBlocker } from '@openmemorykit/ui/contract'
import { ReportKind } from '../../shared/report/report-kind'
import { ONE_LINE_PER_SECOND_MS, printLimitedLine } from './limited-console'
import { traceLimited, traceLine } from './trace'
import type { UseCaseContext } from './use-case-context'

export interface ContractCall {
  readonly name: KitExport
  readonly owner: string
}

export const UNKNOWN_FIELD_ONCE_MS = Number.POSITIVE_INFINITY
const ROOT_PATH = ''
const ERROR_SEPARATOR = ', '
const LIMIT_CODES: ReadonlySet<ContractErrorCode> = new Set([ContractErrorCode.RateLimited, ContractErrorCode.QuotaExceeded])

function traceCallLimited(context: UseCaseContext, call: ContractCall, code: ContractErrorCode): void {
  const { ports, store } = context
  const line = { at: ports.clock.now(), kind: ReportKind.CallLimited, data: { owner: call.owner, call: call.name, code } } as const
  traceLimited(ports, store, line, `${ReportKind.CallLimited}:${call.owner}`, ONE_LINE_PER_SECOND_MS)
}

function traceContractRefused(context: UseCaseContext, call: ContractCall, errors: readonly ContractError[]): void {
  const { ports, store } = context
  const reported = errors.map(({ path, code }) => ({ path, code }))
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.ContractRefused, data: { owner: call.owner, errors: reported } })
  const described = reported.map(({ path, code }) => `${path} ${code}`).join(ERROR_SEPARATOR)
  printLimitedLine(context, `${ReportKind.ContractRefused}:${call.owner}:${call.name}`, ONE_LINE_PER_SECOND_MS, `${call.owner} ${call.name} refused: ${described}`)
}

export function refuseCall(context: UseCaseContext, call: ContractCall, errors: readonly ContractError[]): CallResult {
  const reported = errors.slice(0, MAX_REPORTED_ERRORS)
  const limited = reported.find((error) => LIMIT_CODES.has(error.code))
  if (limited === undefined) traceContractRefused(context, call, reported)
  else traceCallLimited(context, call, limited.code)
  return refusedCall(reported)
}

export function refuseOpening(context: UseCaseContext, call: ContractCall, blocker: OpenBlocker): CallResult {
  const { ports, store } = context
  traceLine(ports, store, { at: ports.clock.now(), kind: ReportKind.OpenRefused, data: { reason: blocker, owner: call.owner } })
  return refusedCall([{ path: ROOT_PATH, code: ContractErrorCode.OpenBlocked, detail: blocker }])
}

export function traceUnknownFields(context: UseCaseContext, call: ContractCall, paths: readonly string[]): void {
  const { ports, store } = context
  paths.forEach((path) => {
    const line = { at: ports.clock.now(), kind: ReportKind.UnknownField, data: { owner: call.owner, path } } as const
    traceLimited(ports, store, line, `${ReportKind.UnknownField}:${call.owner}:${path}`, UNKNOWN_FIELD_ONCE_MS)
  })
}
