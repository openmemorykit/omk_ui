import { describe, expect, it } from 'vitest'
import { ConfigWarningKind } from '../../../src/shared/config/read-config'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { CameraViewMode } from '../../../src/shared/config/camera-view-mode'
import { configSummaryLines } from '../../../src/server/application/config-summary'
import { createServerHarness } from './server-harness'

const WARNING_START = 3
const SUMMARY = 'kit 1.0.0 · contrat 1 · artifact 38435 · langue fr'
const THEME = 'tokens : accent #8F7BFF · côté left · échelle 1 · police sofiaSansSemiCondensed · logo - · monogramme O'
const INPUT = 'touches par défaut : radial F1 · interaction E · seuils : maintien manette 300 ms, geste manette oui, véhicule 10 km/h, vues sautées -'

describe('config summary', () => {
  it('lists the kit, the tokens, the default keys and the thresholds', () => {
    expect(configSummaryLines(createServerHarness().context)).toStrictEqual([SUMMARY, THEME, INPUT])
  })

  it('writes the same summary in english', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('omk_ui_locale', 'en')
    expect(configSummaryLines(context)[0]).toBe('kit 1.0.0 · contract 1 · artifact 38435 · language en')
  })

  it('shows the logo, the skipped views and the pad gesture as configured', () => {
    const { ports, context } = createServerHarness()
    const theme = { ...DEFAULT_CONFIG.theme, logo: 'brand.png' }
    const input = { ...DEFAULT_CONFIG.input, padHoldGesture: false, cameraSkippedModes: [CameraViewMode.FirstPerson, CameraViewMode.ThirdPersonNear] }
    ports.config.setReading({ config: { ...DEFAULT_CONFIG, theme, input }, warnings: [] })
    const lines = configSummaryLines(context)
    expect(lines[1]).toContain('logo brand.png')
    expect(lines.at(-1)).toContain('geste manette non, véhicule 10 km/h, vues sautées 4, 0')
  })

  it('names the artifact as unknown when the version convar cannot be read', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set('version', null)
    expect(configSummaryLines(context)[0]).toBe('kit 1.0.0 · contrat 1 · artifact ? · langue fr')
  })

  it('adds one line per warning of the config, in the language of the journal', () => {
    const { ports, context } = createServerHarness()
    ports.config.setReading({
      config: DEFAULT_CONFIG,
      warnings: [
        { key: 'theme.accent', kind: ConfigWarningKind.Invalid },
        { key: 'theme.colour', kind: ConfigWarningKind.Unknown, detail: 'x' },
        { key: 'input', kind: ConfigWarningKind.Truncated, detail: '21 erreurs' },
      ],
    })
    expect(configSummaryLines(context).slice(WARNING_START)).toStrictEqual([
      'Réglage theme.accent invalide, valeur par défaut gardée',
      'Réglage theme.colour inconnu, ignoré x',
      'Réglages tronqués après input 21 erreurs',
    ])
  })
})
