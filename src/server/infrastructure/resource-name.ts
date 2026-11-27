import { runGuarded } from './guarded-call'

export const KIT_RESOURCE_NAME = 'omk_ui'

export function isRunningAsKit(onRefused: (found: string) => void): boolean {
  const found = GetCurrentResourceName()
  if (found === KIT_RESOURCE_NAME) return true
  runGuarded(() => onRefused(found), () => undefined)
  return false
}
