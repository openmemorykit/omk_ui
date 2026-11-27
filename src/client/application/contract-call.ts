import type { ValueOf } from '@openmemorykit/core/shared'
import { CALL_MAX_BYTES, ContractErrorCode, ContractVersion, KitExport, refusedCall, type CallResult } from '@openmemorykit/ui/contract'
import { isNamespaceOwner } from '../../protocol/namespaced-id'
import { UiMode } from '../../protocol/page-vocabulary'
import { ReportKind } from '../../shared/report/report-kind'
import { CallFamily } from '../domain/call-limits'
import { measureCallBytes } from './call-size'
import { refuseCall, type ContractCall } from './call-refusals'
import { claimsDemoOwnerName } from './demos/demo-catalog'
import { EXPORT_HANDLERS } from './export-handlers'
import { ONE_LINE_PER_MINUTE_MS, traceLimited } from './trace'
import type { UseCaseContext } from './use-case-context'

export const KitQuery = { Version: 'version', IsOpen: 'isOpen' } as const
export type KitQuery = ValueOf<typeof KitQuery>

export interface KitVersion {
  readonly kit: string
  readonly contract: ContractVersion
}

const ROOT_PATH = ''
const NOT_SERIALIZABLE = 'notSerializable'
const DEMO_OWNER_CLAIMED_KEY = `${ReportKind.ForgedCall}:demoOwner`

function familyOf(name: KitExport): CallFamily {
  return name === KitExport.Notify ? CallFamily.Notify : CallFamily.Other
}

function admissionRefusal(context: UseCaseContext, call: ContractCall, args: readonly unknown[]): CallResult | null {
  const bytes = measureCallBytes(args, CALL_MAX_BYTES)
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

function refuseClaimedDemoOwner(context: UseCaseContext, name: KitExport, owner: string): CallResult {
  const { ports, store } = context
  traceLimited(ports, store, { at: ports.clock.now(), kind: ReportKind.ForgedCall, data: { call: `${name} by ${owner}` } }, DEMO_OWNER_CLAIMED_KEY, ONE_LINE_PER_MINUTE_MS)
  return refusedCall([{ path: ROOT_PATH, code: ContractErrorCode.BadIdentifier }])
}

export function callExport(context: UseCaseContext, name: KitExport | KitQuery, owner: string | null, args: readonly unknown[]): CallResult | KitVersion | boolean {
  if (!isKitQuery(name)) {
    if (owner !== null && claimsDemoOwnerName(owner)) return refuseClaimedDemoOwner(context, name, owner)
    return handleContractCall(context, name, owner, args)
  }
  if (name === KitQuery.Version) return { kit: context.kitVersion, contract: ContractVersion.V1 }
  return context.store.read().mode !== UiMode.Idle
}
