import { describe, expect, it, vi } from 'vitest'
import { ArtifactStatus } from '../../../src/server/domain/artifact-rule'
import { checkInstalledArtifact } from '../../../src/server/application/artifact-check'
import { createServerHarness, LOG_PREFIX } from './server-harness'

const OLD_ARTIFACT = 'FXServer-master v1.0.0.37000 linux'
const MINIMUM_ARTIFACT = 'FXServer-master v1.0.0.38435 linux'
const VERY_LONG_LENGTH = 500
const VERY_LONG_VERSION = 'x'.repeat(VERY_LONG_LENGTH)
const MAX_LINE_LENGTH = 200

describe('artifact check', () => {
  it('stays silent on the minimum artifact', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', MINIMUM_ARTIFACT)
    expect(checkInstalledArtifact(context)).toStrictEqual({ status: ArtifactStatus.Supported, build: 38435 })
    expect(ports.console.lines).toStrictEqual([])
  })

  it('warns below 38435 and lets the resource run', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', OLD_ARTIFACT)
    expect(checkInstalledArtifact(context)).toStrictEqual({ status: ArtifactStatus.BelowMinimum, build: 37000 })
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} 01:00.000 · Artifact 37000 sous le minimum exigé 38435`])
    expect(ports.clients.sent).toStrictEqual([])
  })

  it('warns when the version convar says nothing readable, and shows what it said', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', 'custom build')
    expect(checkInstalledArtifact(context).status).toBe(ArtifactStatus.Unknown)
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} 01:00.000 · Numéro d'artifact illisible dans la convar version : custom build`])
  })

  it('neutralises colour codes in the unreadable value, and reads the convar once', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', '^1evil')
    const reads = vi.spyOn(ports.convars, 'read')
    checkInstalledArtifact(context)
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} 01:00.000 · Numéro d'artifact illisible dans la convar version : ^ 1evil`])
    expect(reads.mock.calls.filter(([name]) => name === 'version')).toHaveLength(1)
  })

  it('warns when the convar is absent, and cuts a very long value', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', null)
    checkInstalledArtifact(context)
    ports.convars.set('version', VERY_LONG_VERSION)
    checkInstalledArtifact(context)
    expect(ports.console.lines[0]).toBe(`${LOG_PREFIX} 01:00.000 · Numéro d'artifact illisible dans la convar version : ?`)
    expect(ports.console.lines[1]?.length).toBeLessThan(MAX_LINE_LENGTH)
  })
})
