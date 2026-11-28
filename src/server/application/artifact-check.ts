import { checkArtifact, MINIMUM_ARTIFACT, ArtifactStatus, type ArtifactCheck } from '../domain/artifact-rule'
import type { ServerContext } from './server-context'
import { printable, UNKNOWN_VALUE } from './server-log'

const VERSION_CONVAR = 'version'
const RAW_VERSION_MAX_LENGTH = 80

function readRawVersion(context: ServerContext): string {
  return context.ports.convars.read(VERSION_CONVAR) ?? ''
}

export function readInstalledArtifact(context: ServerContext): ArtifactCheck {
  return checkArtifact(readRawVersion(context))
}

export function checkInstalledArtifact(context: ServerContext): ArtifactCheck {
  const raw = readRawVersion(context)
  const check = checkArtifact(raw)
  const { translate, printStamped } = context.log
  if (check.status === ArtifactStatus.BelowMinimum) {
    printStamped(translate('log.artifact.tooOld', { build: check.build ?? UNKNOWN_VALUE, minimum: MINIMUM_ARTIFACT }))
  }
  if (check.status === ArtifactStatus.Unknown) {
    const shown = printable(raw.slice(0, RAW_VERSION_MAX_LENGTH))
    printStamped(translate('log.artifact.unreadable', { raw: shown.length === 0 ? UNKNOWN_VALUE : shown }))
  }
  return check
}
