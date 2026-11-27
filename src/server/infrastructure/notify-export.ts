import { refusedCall, type CallResult } from '@openmemorykit/ui/contract'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import type { ServerKit } from '../application/ports'

export const NOTIFY_EXPORT_NAME = 'notify'
const NOTIFY_OPERATION = `export ${NOTIFY_EXPORT_NAME}`
const UNKNOWN_TARGET = Number.NaN
const FAILED_CALL: CallResult = refusedCall([])

export type NotifyExportHandler = ServerKit['notifyExport']
type ExportRegistrar = (name: string, handler: (target: unknown, notification: unknown) => CallResult) => void

function invokingResource(): string | null {
  const invoker: unknown = GetInvokingResource()
  return typeof invoker === 'string' && invoker.length > 0 ? invoker : null
}

function targetOf(target: unknown): number {
  return typeof target === 'number' ? target : UNKNOWN_TARGET
}

export function registerNotifyExport(notifyExport: NotifyExportHandler, onFailure: FailureHandler): void {
  const register = (globalThis as unknown as { readonly exports: ExportRegistrar }).exports
  register(NOTIFY_EXPORT_NAME, (target, notification) =>
    guardedCall(onFailure, NOTIFY_OPERATION, () => notifyExport(targetOf(target), notification, invokingResource()), FAILED_CALL))
}
