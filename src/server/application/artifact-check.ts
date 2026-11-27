import { checkArtifact, MINIMUM_ARTIFACT, ArtifactStatus, type ArtifactCheck } from '../domain/artifact-rule'
import type { ServerContext } from './server-context'
import { UNKNOWN_VALUE } from './server-log'

const VERSION_CONVAR = 'version'
const RAW_VERSION_MAX_LENGTH = 80

export function readInstalledArtifact(context: ServerContext): ArtifactCheck {
  return checkArtifact(context.ports.convars.read(VERSION_CONVAR) ?? '')
}

export function checkInstalledArtifact(context: ServerContext): ArtifactCheck {
  const check = readInstalledArtifact(context)
  const { translate, printStamped } = context.log
  if (check.status === ArtifactStatus.BelowMinimum) {
    printStamped(translate('log.artifact.tooOld', { build: check.build ?? UNKNOWN_VALUE, minimum: MINIMUM_ARTIFACT }))
  }
  if (check.status === ArtifactStatus.Unknown) {
    const raw = (context.ports.convars.read(VERSION_CONVAR) ?? '').slice(0, RAW_VERSION_MAX_LENGTH)
    printStamped(translate('log.artifact.unreadable', { raw: raw.length === 0 ? UNKNOWN_VALUE : raw }))
  }
  return check
}
