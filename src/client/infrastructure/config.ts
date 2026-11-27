import { DEFAULT_CONFIG } from '../../shared/config/config-schema'
import { ConfigWarningKind, readConfig, type ConfigReading } from '../../shared/config/read-config'
import type { ConfigSource } from '../../shared/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

const KIT_RESOURCE = 'omk_ui'
const CONFIG_EXPORT = 'getConfig'
const ROOT_KEY = ''

const UNAVAILABLE: ConfigReading = { config: DEFAULT_CONFIG, warnings: [{ key: ROOT_KEY, kind: ConfigWarningKind.Invalid }] }

type ConfigExport = () => unknown

function configExport(): ConfigExport {
  const getConfig = globalThis.exports[KIT_RESOURCE]?.[CONFIG_EXPORT] as ConfigExport | undefined
  if (getConfig === undefined) throw new Error(`${KIT_RESOURCE} has no ${CONFIG_EXPORT} export`)
  return getConfig
}

export function createConfigSource(onFailure: FailureHandler): ConfigSource {
  return { read: () => guardedCall(onFailure, `exports.${KIT_RESOURCE}.${CONFIG_EXPORT}`, () => readConfig(configExport()()), UNAVAILABLE) }
}
