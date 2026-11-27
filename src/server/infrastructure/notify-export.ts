import { refusedCall, type CallResult } from '@openmemorykit/ui/contract'
import type { ServerKit } from '../application/ports'
import { runGuardedWithFallback, type FailureHandler } from './guarded-call'

export const NOTIFY_EXPORT_NAME = 'notify'
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
    runGuardedWithFallback(() => notifyExport(targetOf(target), notification, invokingResource()), FAILED_CALL, onFailure))
}
