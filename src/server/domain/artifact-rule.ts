import type { ValueOf } from '@openmemorykit/core/shared'

export const MINIMUM_ARTIFACT = 38435

export const ArtifactStatus = { Supported: 'supported', BelowMinimum: 'belowMinimum', Unknown: 'unknown' } as const
export type ArtifactStatus = ValueOf<typeof ArtifactStatus>

export interface ArtifactCheck {
  readonly status: ArtifactStatus
  readonly build: number | null
}

const ARTIFACT_BUILD_PATTERN = /v\d+\.\d+\.\d+\.(\d+)/

export function parseArtifactBuild(version: string): number | null {
  const digits = ARTIFACT_BUILD_PATTERN.exec(version)?.[1]
  if (digits === undefined) return null
  const build = Number(digits)
  return Number.isSafeInteger(build) ? build : null
}

export function checkArtifact(version: string): ArtifactCheck {
  const build = parseArtifactBuild(version)
  if (build === null) return { status: ArtifactStatus.Unknown, build }
  return { status: build < MINIMUM_ARTIFACT ? ArtifactStatus.BelowMinimum : ArtifactStatus.Supported, build }
}
