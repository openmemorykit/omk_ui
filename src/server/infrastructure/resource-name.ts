import { guardedCall } from '../../shared/guarded-call'

export const KIT_RESOURCE_NAME = 'omk_ui'

const IGNORE_REFUSAL_FAILURE = (): void => undefined

export function isRunningAsKit(onRefused: (found: string) => void): boolean {
  const found = GetCurrentResourceName()
  if (found === KIT_RESOURCE_NAME) return true
  guardedCall(IGNORE_REFUSAL_FAILURE, 'refused resource name', () => onRefused(found), undefined)
  return false
}
