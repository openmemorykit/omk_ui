import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import { createServerHarness, LOG_PREFIX, run } from './command-harness'

const SUMMARY_LINES = 3
const RUNS = 2
const TITLE_AND_SUMMARY = 2

describe('omk_ui version', () => {
  it('names the kit, the contract, the artifact and the minimum required', () => {
    expect(run(createServerHarness(), OmkSubcommand.Version)).toStrictEqual([`${LOG_PREFIX} kit 1.0.0 · contrat 1 · artifact 38435 · minimum exigé 38435`])
  })

  it('shows the artifact of the server when it is older', () => {
    const harness = createServerHarness()
    harness.ports.convars.set('version', 'FXServer-master v1.0.0.37000 linux')
    expect(run(harness, OmkSubcommand.Version)[0]).toContain('artifact 37000')
  })

  it('shows a question mark when the artifact cannot be read', () => {
    const harness = createServerHarness()
    harness.ports.convars.set('version', null)
    expect(run(harness, OmkSubcommand.Version)[0]).toContain('artifact ?')
  })
})

describe('omk_ui config', () => {
  it('writes a title, then the summary of the effective config', () => {
    const lines = run(createServerHarness(), OmkSubcommand.Config)
    expect(lines.slice(0, TITLE_AND_SUMMARY)).toStrictEqual([`${LOG_PREFIX} Résumé de la config effective`, 'kit 1.0.0 · contrat 1 · artifact 38435 · langue fr'])
    expect(lines).toHaveLength(SUMMARY_LINES + 1)
  })

  it('reads the config again each time', () => {
    const harness = createServerHarness()
    Array.from({ length: RUNS }).forEach(() => run(harness, OmkSubcommand.Config))
    expect(harness.ports.config.readCount).toBe(RUNS)
  })
})
