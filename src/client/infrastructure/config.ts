import { DEFAULT_CONFIG } from '../../shared/config/config-schema'
import { ConfigWarningKind, readConfig, type ConfigReading } from '../../shared/config/read-config'
import type { ConfigSource } from '../../shared/ports'
import { KIT_RESOURCE_NAME } from '../../shared/kit-resource'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

const CONFIG_EXPORT = 'getConfig'
const ROOT_KEY = ''

const UNAVAILABLE: ConfigReading = { config: DEFAULT_CONFIG, warnings: [{ key: ROOT_KEY, kind: ConfigWarningKind.Invalid }] }

interface KitExports {
  readonly [CONFIG_EXPORT]: () => unknown
}

function callConfigExport(): unknown {
  const kitExports = globalThis.exports[KIT_RESOURCE_NAME] as unknown as KitExports
  return kitExports[CONFIG_EXPORT]()
}

export function createConfigSource(onFailure: FailureHandler): ConfigSource {
  return { read: () => guardedCall(onFailure, `exports.${KIT_RESOURCE_NAME}.${CONFIG_EXPORT}`, () => readConfig(callConfigExport()), UNAVAILABLE) }
}
