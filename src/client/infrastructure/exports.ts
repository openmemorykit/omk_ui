import { ContractErrorCode, KitExport, refusedCall, type CallResult } from '@openmemorykit/ui/contract'
import { KitQuery } from '../application/contract-call'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

export type KitExportName = KitExport | KitQuery
export type KitExportCaller = (name: KitExportName, owner: string | null, args: readonly unknown[]) => unknown

const NOT_OPEN = false
const ROOT_PATH = ''
const HANDLER_FAILED = 'handlerFailed'

function invokingOwner(): string | null {
  const resource: unknown = GetInvokingResource()
  return typeof resource === 'string' && resource.length > 0 ? resource : null
}

function resultOfFailedCall(name: KitExportName): CallResult | boolean {
  if (name === KitQuery.IsOpen) return NOT_OPEN
  return refusedCall([{ path: ROOT_PATH, code: ContractErrorCode.WrongType, detail: HANDLER_FAILED }])
}

function exportHandler(name: KitExportName, callKit: KitExportCaller, onFailure: FailureHandler): (...args: unknown[]) => unknown {
  return (...args) => guardedCall(onFailure, `export ${name}`, () => callKit(name, invokingOwner(), args), resultOfFailedCall(name))
}

export function registerKitExports(callKit: KitExportCaller, onFailure: FailureHandler): void {
  const names: readonly KitExportName[] = [...Object.values(KitExport), ...Object.values(KitQuery)]
  for (const name of names) {
    guardedCall(onFailure, `register export ${name}`, () => globalThis.exports(name, exportHandler(name, callKit, onFailure)), undefined)
  }
}
