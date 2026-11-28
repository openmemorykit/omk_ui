import { CALL_DONE, CallStatus, ContractErrorCode, NotificationSchema, refusedCall, type CallResult, type ContractError } from '@openmemorykit/ui/contract'
import { validateContract, ValidationStatus } from '@openmemorykit/ui/validation'
import { CommandKind } from '../../shared/net/net-events'
import { OWNER_MAX_LENGTH } from '../../protocol/namespaced-id'
import { printable } from './server-log'
import { ALL_CLIENTS } from './ports'
import type { ServerContext } from './server-context'

const TARGET_PATH = 'target'
const ERROR_SEPARATOR = ', '
const UNKNOWN_TARGET: ContractError = Object.freeze({ path: TARGET_PATH, code: ContractErrorCode.UnknownValue })

function isKnownTarget(context: ServerContext, target: unknown): target is number {
  return target === ALL_CLIENTS || (typeof target === 'number' && Number.isSafeInteger(target) && context.ports.players.exists(target))
}

export function relayNotification(context: ServerContext, target: unknown, notification: unknown): CallResult {
  if (!isKnownTarget(context, target)) return refusedCall([UNKNOWN_TARGET])
  const validation = validateContract(NotificationSchema, notification)
  if (validation.status === ValidationStatus.Refused) return refusedCall(validation.errors)
  context.ports.clients.send(target, { kind: CommandKind.Notify, notification: validation.value })
  return CALL_DONE
}

function describeTarget(context: ServerContext, target: unknown): string {
  return target === ALL_CLIENTS ? context.log.translate('log.trace.allPlayers') : printable(String(target))
}

function journalCall(context: ServerContext, target: unknown, caller: string | null, result: CallResult): void {
  const { translate, printStamped } = context.log
  const name = caller === null ? translate('log.notify.noCaller') : printable(caller.slice(0, OWNER_MAX_LENGTH))
  const where = describeTarget(context, target)
  if (result.status === CallStatus.Done) printStamped(translate('log.notify.called', { caller: name, target: where }))
  else printStamped(translate('log.notify.refused', { caller: name, target: where, errors: result.errors.map((error) => error.path).join(ERROR_SEPARATOR) }))
}

export function notifyFromResource(context: ServerContext, target: unknown, notification: unknown, caller: string | null): CallResult {
  const result = relayNotification(context, target, notification)
  journalCall(context, target, caller, result)
  return result
}
