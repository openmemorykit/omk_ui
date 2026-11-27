import { ContractVersion } from '@openmemorykit/ui/contract'
import { ConfigWarningKind, type ConfigWarning } from '../../shared/config/read-config'
import { readInstalledArtifact } from './artifact-check'
import { NOT_SET, UNKNOWN_VALUE, type LogKey } from './server-log'
import type { ServerContext } from './server-context'

const DEFAULT_RADIAL_KEY = 'F1'
const DEFAULT_INTERACT_KEY = 'E'
const LIST_SEPARATOR = ', '

const WARNING_KEYS: Readonly<Record<ConfigWarningKind, LogKey>> = {
  [ConfigWarningKind.Invalid]: 'log.config.warning.invalid',
  [ConfigWarningKind.Unknown]: 'log.config.warning.unknown',
  [ConfigWarningKind.Truncated]: 'log.config.warning.truncated',
}

function warningLine(context: ServerContext, warning: ConfigWarning): string {
  const line = context.log.translate(WARNING_KEYS[warning.kind], { key: warning.key, detail: warning.detail ?? '' })
  return line.trimEnd()
}

export function configSummaryLines(context: ServerContext): readonly string[] {
  const { translate } = context.log
  const { config, warnings } = context.ports.config.read()
  const yesOrNo = (value: boolean): string => translate(value ? 'log.word.yes' : 'log.word.no')
  const { theme, input } = config
  const artifact = readInstalledArtifact(context).build
  return [
    translate('log.config.summary', {
      kitVersion: context.kitVersion,
      contractVersion: ContractVersion.V1,
      artifact: artifact ?? UNKNOWN_VALUE,
      locale: context.log.locale(),
    }),
    translate('log.config.theme', { accent: theme.accent, side: theme.side, scale: theme.scale, font: theme.font, logo: theme.logo ?? NOT_SET, monogram: theme.monogram }),
    translate('log.config.input', {
      radialKey: DEFAULT_RADIAL_KEY,
      interactKey: DEFAULT_INTERACT_KEY,
      padHoldMs: input.padHoldMs,
      padHoldGesture: yesOrNo(input.padHoldGesture),
      vehicleSpeedLimit: input.vehicleSpeedLimit,
      cameraSkippedModes: input.cameraSkippedModes.length === 0 ? NOT_SET : input.cameraSkippedModes.join(LIST_SEPARATOR),
    }),
    ...warnings.map((warning) => warningLine(context, warning)),
  ]
}
