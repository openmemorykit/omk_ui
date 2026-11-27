import { readConfig, type ConfigReading } from '../../shared/config/read-config'
import type { ConfigSource } from '../../shared/ports'
import { runGuardedWithFallback, type FailureHandler } from './guarded-call'
import { KIT_RESOURCE_NAME } from './resource-name'

export const CONFIG_EXPORT_NAME = 'getConfig'
const UNREADABLE_CONFIG = undefined

interface KitExports {
  readonly [KIT_RESOURCE_NAME]: { readonly [CONFIG_EXPORT_NAME]: () => unknown }
}

function callConfigExport(): unknown {
  return (globalThis as unknown as { readonly exports: KitExports }).exports[KIT_RESOURCE_NAME][CONFIG_EXPORT_NAME]()
}

export function createConfigSource(onFailure: FailureHandler): ConfigSource {
  return {
    read: (): ConfigReading => readConfig(runGuardedWithFallback(callConfigExport, UNREADABLE_CONFIG, onFailure)),
  }
}
