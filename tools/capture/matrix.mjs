export const SCENARIO_IDS = [
  'radial',
  'radial-children',
  'whitelist-list',
  'whitelist',
  'long-list',
  'disabled-focused',
  'form-errors',
  'form-pending',
  'keyboard-letters',
  'keyboard-accents',
  'keyboard-symbols',
  'confirm-danger',
  'toasts',
  'prompt-hold',
]

const FULL_HD = { width: 1920, height: 1080 }
const WIDE_RESOLUTIONS = [{ width: 1280, height: 720 }, { width: 2560, height: 1440 }]
const WIDE_SCENARIOS = new Set(['radial', 'radial-children', 'whitelist-list', 'long-list', 'keyboard-letters', 'keyboard-accents', 'keyboard-symbols'])
const GLYPH_SCENARIOS = new Set(['radial', 'whitelist-list', 'keyboard-letters'])
const REDUCED_MOTION_SCENARIO = 'prompt-hold'
const LIGHT_ACCENT = '#FFE066'
const SCALES = [0.9, 1.1]
const LANGUAGE = 'fr'

const BASE = { scene: 'night', glyphs: 'xbox', side: 'left', accent: null, scale: null, reducedMotion: false }
const FULL_HD_VARIANTS = [
  ['base', {}],
  ['day', { scene: 'day' }],
  ['right', { side: 'right' }],
  ['accent-light', { accent: LIGHT_ACCENT }],
  ...SCALES.map((scale) => [`scale-${scale}`, { scale }]),
]

const spec = (scenario, resolution, variant, changes) => {
  const name = `${scenario}-${resolution.width}x${resolution.height}-${variant}`
  return { name, file: `${name}.png`, scenario, ...resolution, variant, ...BASE, ...changes }
}

export function buildMatrix() {
  return SCENARIO_IDS.flatMap((scenario) => [
    ...FULL_HD_VARIANTS.map(([variant, changes]) => spec(scenario, FULL_HD, variant, changes)),
    ...(GLYPH_SCENARIOS.has(scenario) ? [spec(scenario, FULL_HD, 'playStation', { glyphs: 'playStation' })] : []),
    ...(WIDE_SCENARIOS.has(scenario) ? WIDE_RESOLUTIONS.map((resolution) => spec(scenario, resolution, 'base', {})) : []),
    ...(scenario === REDUCED_MOTION_SCENARIO ? [spec(scenario, FULL_HD, 'reduced-motion', { reducedMotion: true })] : []),
  ])
}

export function captureUrl(capture) {
  const params = new URLSearchParams({
    scenario: capture.scenario,
    res: `${capture.width}x${capture.height}`,
    scene: capture.scene,
    glyphs: capture.glyphs,
    side: capture.side,
    lang: LANGUAGE,
    capture: '1',
  })
  if (capture.accent !== null) params.set('accent', capture.accent)
  if (capture.scale !== null) params.set('scale', String(capture.scale))
  return `/?${params.toString()}`
}
