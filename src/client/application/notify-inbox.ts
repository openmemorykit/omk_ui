import { KitExport } from '@openmemorykit/ui/contract'
import { handleContractCall } from './contract-call'
import type { UseCaseContext } from './use-case-context'

export const SERVER_NOTIFICATION_OWNER = 'omk_ui'

export function receiveServerNotification(context: UseCaseContext, notification: unknown): void {
  handleContractCall(context, KitExport.Notify, SERVER_NOTIFICATION_OWNER, [notification])
}
