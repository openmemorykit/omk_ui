import { readConfig, type ConfigReading } from '../../shared/config/read-config'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'
import type { ConfigSource } from '../../shared/ports'
import { KIT_RESOURCE_NAME } from './resource-name'

export const CONFIG_EXPORT_NAME = 'getConfig'
const UNREADABLE_CONFIG = undefined
const CONFIG_OPERATION = `exports.${KIT_RESOURCE_NAME}.${CONFIG_EXPORT_NAME}`

interface KitExports {
  readonly [KIT_RESOURCE_NAME]: { readonly [CONFIG_EXPORT_NAME]: () => unknown }
}

function callConfigExport(): unknown {
  return (globalThis as unknown as { readonly exports: KitExports }).exports[KIT_RESOURCE_NAME][CONFIG_EXPORT_NAME]()
}

export function createConfigSource(onFailure: FailureHandler): ConfigSource {
  return {
    read: (): ConfigReading => readConfig(guardedCall(onFailure, CONFIG_OPERATION, callConfigExport, UNREADABLE_CONFIG)),
  }
}
