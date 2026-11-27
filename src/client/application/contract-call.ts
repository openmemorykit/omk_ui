import { serializedByteLength, type ValueOf } from '@openmemorykit/core/shared'
import { CALL_MAX_BYTES, ContractErrorCode, ContractVersion, KitExport, refusedCall, type CallResult } from '@openmemorykit/ui/contract'
import { isNamespaceOwner } from '../../protocol/namespaced-id'
import { UiMode } from '../../protocol/page-vocabulary'
import { CallFamily } from '../domain/call-limits'
import { refuseCall, type ContractCall } from './call-refusals'
import { EXPORT_HANDLERS } from './export-handlers'
import type { UseCaseContext } from './use-case-context'

export const KitQuery = { Version: 'version', IsOpen: 'isOpen' } as const
export type KitQuery = ValueOf<typeof KitQuery>

export interface KitVersion {
  readonly kit: string
  readonly contract: ContractVersion
}

const ROOT_PATH = ''
const NOT_SERIALIZABLE = 'notSerializable'

function familyOf(name: KitExport): CallFamily {
  return name === KitExport.Notify ? CallFamily.Notify : CallFamily.Other
}

function admissionRefusal(context: UseCaseContext, call: ContractCall, args: readonly unknown[]): CallResult | null {
  const bytes = serializedByteLength(args)
  if (bytes === null) return refuseCall(context, call, [{ path: ROOT_PATH, code: ContractErrorCode.WrongType, detail: NOT_SERIALIZABLE }])
  const limited = context.limiter.admit(call.owner, familyOf(call.name), bytes, context.ports.clock.now())
  if (limited !== null) return refuseCall(context, call, [limited])
  if (bytes > CALL_MAX_BYTES) return refuseCall(context, call, [{ path: ROOT_PATH, code: ContractErrorCode.TooLarge }])
  return null
}

export function handleContractCall(context: UseCaseContext, name: KitExport, owner: string | null, args: readonly unknown[]): CallResult {
  if (owner === null || !isNamespaceOwner(owner)) return refusedCall([{ path: ROOT_PATH, code: ContractErrorCode.BadIdentifier }])
  const call = { name, owner }
  return admissionRefusal(context, call, args) ?? EXPORT_HANDLERS[name](context, call, args)
}

function isKitQuery(name: KitExport | KitQuery): name is KitQuery {
  return name === KitQuery.Version || name === KitQuery.IsOpen
}

export function callExport(context: UseCaseContext, name: KitExport | KitQuery, owner: string | null, args: readonly unknown[]): CallResult | KitVersion | boolean {
  if (!isKitQuery(name)) return handleContractCall(context, name, owner, args)
  if (name === KitQuery.Version) return { kit: context.kitVersion, contract: ContractVersion.V1 }
  return context.store.read().mode !== UiMode.Idle
}
