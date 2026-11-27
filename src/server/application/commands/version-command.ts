import { ContractVersion } from '@openmemorykit/ui/contract'
import { MINIMUM_ARTIFACT } from '../../domain/artifact-rule'
import { readInstalledArtifact } from '../artifact-check'
import { UNKNOWN_VALUE } from '../server-log'
import type { SubcommandHandler } from './command-arguments'

export const versionCommand: SubcommandHandler = (context) => [
  context.log.translate('log.command.version', {
    kitVersion: context.kitVersion,
    contractVersion: ContractVersion.V1,
    artifact: readInstalledArtifact(context).build ?? UNKNOWN_VALUE,
    minimum: MINIMUM_ARTIFACT,
  }),
]
