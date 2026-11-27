import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ALL_CLIENTS } from '../../../src/server/application/ports'
import { serverStarted } from '../../../src/server/application/server-started'
import { CommandKind } from '../../../src/shared/net/net-events'
import { createServerHarness, LOG_PREFIX, PLAYER } from './server-harness'

const SUMMARY_LINES = 3
const SUMMARY_FIRST_LINE = `${LOG_PREFIX} kit 1.0.0 · contrat 1 · artifact 38435 · langue fr`
const OLD_ARTIFACT = 'FXServer-master v1.0.0.37000 linux'

describe('server started', () => {
  it('writes the summary of the config, the first line carrying the prefix', () => {
    const { ports, context } = createServerHarness()
    serverStarted(context)
    expect(ports.console.lines).toHaveLength(SUMMARY_LINES)
    expect(ports.console.lines[0]).toBe(SUMMARY_FIRST_LINE)
    expect(ports.console.lines[1]).toMatch(/^tokens : /)
  })

  it('leaves the journal cut and sends nothing to the clients by default', () => {
    const { ports, context } = createServerHarness()
    serverStarted(context)
    expect(ports.clients.sent).toStrictEqual([])
    expect(context.traces.isActive(PLAYER)).toBe(false)
  })

  it('turns the journal on for everybody when trace.onStart is true, and tells the clients', () => {
    const { ports, context } = createServerHarness()
    ports.config.setReading({ config: { ...DEFAULT_CONFIG, trace: { onStart: true } }, warnings: [] })
    serverStarted(context)
    expect(context.traces.isActive(PLAYER)).toBe(true)
    expect(ports.clients.sent).toStrictEqual([{ target: ALL_CLIENTS, command: { kind: CommandKind.Trace, active: true } }])
    expect(ports.console.lines.some((line) => line.includes('Journal activé au démarrage (trace.onStart)'))).toBe(true)
  })

  it('warns about an artifact below the minimum before the summary, and still starts', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', OLD_ARTIFACT)
    serverStarted(context)
    expect(ports.console.lines[0]).toContain('Artifact 37000 sous le minimum exigé 38435')
    expect(ports.console.lines[1]).toContain('artifact 37000')
  })
})
