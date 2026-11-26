import { describe, expect, it } from 'vitest'
import { ArtifactStatus, checkArtifact, MINIMUM_ARTIFACT, parseArtifactBuild } from '../../../src/server/domain/artifact-rule'

const PLAN_MINIMUM = 38435
const BELOW_MINIMUM = 38434
const CONVAR_LENGTH = 10_000
const PASSES = 100
const AVERAGE_BUDGET_MS = 1
const OVERSIZED_DIGITS = 400

const worstConvars = [
  `v${'1'.repeat(CONVAR_LENGTH - 1)}`,
  `v1.1.1.${'v1.1.1'.repeat(CONVAR_LENGTH)}`.slice(0, CONVAR_LENGTH),
  'v1.'.repeat(CONVAR_LENGTH).slice(0, CONVAR_LENGTH),
  'v1.1.1.x'.repeat(CONVAR_LENGTH).slice(0, CONVAR_LENGTH),
  `v${'1.'.repeat(CONVAR_LENGTH)}`.slice(0, CONVAR_LENGTH),
]

function averageMilliseconds(action: () => void): number {
  for (let pass = 0; pass < PASSES; pass += 1) action()
  const start = Date.now()
  for (let pass = 0; pass < PASSES; pass += 1) action()
  return (Date.now() - start) / PASSES
}

describe('artifact rule', () => {
  it('uses the minimum of the plan', () => {
    expect(MINIMUM_ARTIFACT).toBe(PLAN_MINIMUM)
  })

  it('reads the build of the tested artifact', () => {
    expect(parseArtifactBuild('FXServer-master v1.0.0.38435 linux')).toBe(PLAN_MINIMUM)
    expect(checkArtifact('FXServer-master v1.0.0.38435 linux')).toEqual({ status: ArtifactStatus.Supported, build: PLAN_MINIMUM })
  })

  it('accepts a newer build', () => {
    expect(checkArtifact('FXServer-master v1.0.0.40000 win32').status).toBe(ArtifactStatus.Supported)
  })

  it('flags a build below the minimum', () => {
    expect(checkArtifact('FXServer-master v1.0.0.38434 linux')).toEqual({ status: ArtifactStatus.BelowMinimum, build: BELOW_MINIMUM })
  })

  it.each(['', 'FXServer-master linux', 'FXServer-master v1.0.0 linux', 'v1.0.0.', 'FXServer-master 1.0.0.38435 linux'])('reports %j as unknown', (version) => {
    expect(parseArtifactBuild(version)).toBeNull()
    expect(checkArtifact(version)).toEqual({ status: ArtifactStatus.Unknown, build: null })
  })

  it('reports a build too large for a safe integer as unknown instead of supported', () => {
    expect(checkArtifact(`FXServer-master v1.0.0.${'9'.repeat(OVERSIZED_DIGITS)} linux`)).toEqual({ status: ArtifactStatus.Unknown, build: null })
  })

  it.each(worstConvars.map((convar, index) => [index, convar]))('reads the worst convar %i of 10 000 characters in under 1 ms on average', (_index, convar) => {
    expect(convar.length).toBe(CONVAR_LENGTH)
    expect(averageMilliseconds(() => parseArtifactBuild(convar))).toBeLessThan(AVERAGE_BUDGET_MS)
  })
})
