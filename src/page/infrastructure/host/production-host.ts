import type { HostBridge } from '../../application/ports'
import { createFivemHost } from './fivem-host'

const RESOURCE_NAME_GETTER = 'GetParentResourceName'

function resourceNameOf(win: Window): string | null {
  try {
    const getter: unknown = Reflect.get(win, RESOURCE_NAME_GETTER)
    if (typeof getter !== 'function') return null
    const name: unknown = getter.call(win)
    return typeof name === 'string' && name.length > 0 ? name : null
  } catch {
    return null
  }
}

export function createProductionHost(win: Window): HostBridge | null {
  const name = resourceNameOf(win)
  if (name === null) return null
  return createFivemHost(win, name, (input, init) => win.fetch(input, init), (line) => console.warn(line))
}
