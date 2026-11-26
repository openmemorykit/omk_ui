import { describe, expect, it } from 'vitest'
import { DEFAULT_PREVIEW_SETTINGS, PreviewLanguage, PreviewScene } from '../../../preview/runtime/preview-settings'
import { ScenarioId } from '../../../preview/runtime/types'
import { readUrlScenario, readUrlSettings, toSearch } from '../../../preview/shell/url-settings'
import { GlyphSet } from '../../../src/protocol/page-vocabulary'
import { PanelSide } from '../../../src/shared/config/theme-defaults'

const SMALLEST_SCALE = 0.9
const LARGEST_SCALE = 1.1

describe('readUrlSettings', () => {
  it('returns the defaults for an empty query', () => {
    expect(readUrlSettings('')).toEqual(DEFAULT_PREVIEW_SETTINGS)
    expect(readUrlSettings('?')).toEqual(DEFAULT_PREVIEW_SETTINGS)
  })

  it('reads every setting of the URL contract', () => {
    const search = '?scenario=radial&res=1280x720&scene=day&glyphs=playStation&side=right&accent=%23FFD166&scale=1.1&lang=en&capture=1'
    expect(readUrlSettings(search)).toEqual({
      resolution: { width: 1280, height: 720 },
      scene: PreviewScene.Day,
      glyphSet: GlyphSet.PlayStation,
      side: PanelSide.Right,
      accent: '#FFD166',
      scale: LARGEST_SCALE,
      language: PreviewLanguage.English,
      capture: true,
    })
  })

  it('accepts a query without the question mark and a lowercase accent', () => {
    expect(readUrlSettings('scene=day&accent=%23ffd166')).toMatchObject({ scene: PreviewScene.Day, accent: '#ffd166' })
  })

  it.each([
    ['resolution', 'res=abc'],
    ['resolution', 'res=1920'],
    ['resolution', 'res=1920x'],
    ['resolution', 'res=1920X1080'],
    ['resolution', 'res=0x0'],
    ['resolution', 'res=-1920x1080'],
    ['resolution', 'res=1e3x1000'],
    ['resolution', 'res=99999x1080'],
    ['resolution', 'res=1920x99999'],
    ['resolution', 'res=100x100'],
    ['scene', 'scene=dusk'],
    ['scene', 'scene=DAY'],
    ['glyphSet', 'glyphs=nintendo'],
    ['glyphSet', 'glyphs=playstation'],
    ['side', 'side=middle'],
    ['accent', 'accent=FFD166'],
    ['accent', 'accent=%23FFF'],
    ['accent', 'accent=%23GGGGGG'],
    ['accent', 'accent=%23000000'],
    ['scale', 'scale=0.89'],
    ['scale', 'scale=1.11'],
    ['scale', 'scale=abc'],
    ['scale', 'scale=NaN'],
    ['scale', 'scale=Infinity'],
    ['scale', 'scale='],
    ['language', 'lang=de'],
    ['capture', 'capture=0'],
    ['capture', 'capture=true'],
    ['capture', 'capture=2'],
  ] as const)('falls back to the default for a bad %s (%s)', (field, query) => {
    expect(readUrlSettings(`?${query}`)[field]).toEqual(DEFAULT_PREVIEW_SETTINGS[field])
  })

  it('keeps the valid settings when another one is bad', () => {
    expect(readUrlSettings('?scene=day&res=nope&lang=en')).toEqual({
      ...DEFAULT_PREVIEW_SETTINGS,
      scene: PreviewScene.Day,
      language: PreviewLanguage.English,
    })
  })

  it('accepts the bounds of the scale and of the resolution', () => {
    expect(readUrlSettings('?scale=0.9').scale).toBe(SMALLEST_SCALE)
    expect(readUrlSettings('?scale=1.1').scale).toBe(LARGEST_SCALE)
    expect(readUrlSettings('?res=640x360').resolution).toEqual({ width: 640, height: 360 })
    expect(readUrlSettings('?res=7680x4320').resolution).toEqual({ width: 7680, height: 4320 })
  })

  it('uses the first value of a repeated key', () => {
    expect(readUrlSettings('?scene=day&scene=night').scene).toBe(PreviewScene.Day)
  })

  it('never reads inherited object keys as settings', () => {
    expect(readUrlSettings('?__proto__=x&constructor=y&toString=z')).toEqual(DEFAULT_PREVIEW_SETTINGS)
  })
})

describe('readUrlScenario', () => {
  it('reads a known scenario', () => {
    for (const id of Object.values(ScenarioId)) expect(readUrlScenario(`?scenario=${id}`)).toBe(id)
  })

  it.each(['', '?scenario=', '?scenario=unknown', '?scenario=__proto__', '?scenario=RADIAL'])('falls back to radial for %j', (search) => {
    expect(readUrlScenario(search)).toBe(ScenarioId.Radial)
  })
})

describe('toSearch', () => {
  it('writes a query that reads back to the same scenario and settings', () => {
    const settings = { ...DEFAULT_PREVIEW_SETTINGS, scene: PreviewScene.Day, side: PanelSide.Right, accent: '#FFD166', capture: true }
    const search = toSearch(ScenarioId.LongList, settings)
    expect(search.startsWith('?')).toBe(true)
    expect(readUrlScenario(search)).toBe(ScenarioId.LongList)
    expect(readUrlSettings(search)).toEqual(settings)
  })

  it('does not write the capture flag when it is off', () => {
    expect(toSearch(ScenarioId.Radial, DEFAULT_PREVIEW_SETTINGS)).not.toContain('capture')
  })
})
