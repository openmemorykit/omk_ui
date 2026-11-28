import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkColumnVeil,
  checkConsole,
  checkContrast,
  checkDurations,
  checkEssentialMotion,
  checkHorizontalOverflow,
  checkRadialFits,
  RADIAL_SELECTOR,
  checkReady,
  checkSurfaces,
  checkTextSize,
  contrastRatio,
  runChecks,
} from '../../tools/capture/checks.mjs'

interface Text { text: string; fontSize: number; role: string; color: string; backgrounds: string[] }
interface Surface { surface: string; backgroundColor: string; opacityProduct: number; backdropFilter: string; filter: string; backgroundImage: string }
interface Survey {
  viewport: { width: number; height: number }
  scrollWidth: number
  texts: Text[]
  surfaces: Surface[]
  radial: { left: number; top: number; right: number; bottom: number } | null
  column: { dimmed: boolean; opacityProduct: number; veilColor: string; veilDisplay?: string } | null
  animations: Array<{ selector: string; durationsMs: number[]; exempt: boolean }>
  essentialAnimated: number
}

const PANEL = 'rgb(12, 11, 19)'
const INK = 'rgb(244, 242, 249)'
const text = (overrides: Partial<Text> = {}): Text => ({ text: 'Garage', fontSize: 18, role: 'primary', color: INK, backgrounds: [PANEL], ...overrides })
const surface = (overrides: Partial<Surface> = {}): Surface => ({
  surface: 'column', backgroundColor: 'rgba(12, 11, 19, 1)', opacityProduct: 1, backdropFilter: 'none', filter: 'none', backgroundImage: 'none', ...overrides,
})
const survey = (overrides: Partial<Survey> = {}): Survey => ({
  viewport: { width: 1920, height: 1080 },
  scrollWidth: 1920,
  texts: [text()],
  surfaces: [surface()],
  radial: null,
  column: null,
  animations: [{ selector: '.omk-row', durationsMs: [90, 0], exempt: false }],
  essentialAnimated: 2,
  ...overrides,
})
const checksOf = (failures: ReadonlyArray<{ check: string }>): string[] => failures.map((failure) => failure.check)

describe('checkTextSize', () => {
  it('accepts 16 px and above in 1080p, and 16.2 px at theme.scale 0.9', () => {
    expect(checkTextSize(survey({ texts: [text({ fontSize: 16 }), text({ fontSize: 16.2 })] }))).toEqual([])
  })

  it('rejects text under 16 px in 1080p and names the text', () => {
    const failures = checkTextSize(survey({ texts: [text({ text: 'Tiny', fontSize: 15.5 })] }))
    expect(checksOf(failures)).toEqual(['text-size'])
    expect(failures[0]?.message).toContain('Tiny')
  })

  it('accepts 14.4 px in 720p and rejects 14 px there', () => {
    const hd = { width: 1280, height: 720 }
    expect(checkTextSize(survey({ viewport: hd, texts: [text({ fontSize: 14.4 })] }))).toEqual([])
    expect(checksOf(checkTextSize(survey({ viewport: hd, texts: [text({ fontSize: 14 })] })))).toEqual(['text-size'])
  })

  it('holds 2560x1440 to the 16 px floor', () => {
    const qhd = { width: 2560, height: 1440 }
    expect(checksOf(checkTextSize(survey({ viewport: qhd, texts: [text({ fontSize: 15 })] })))).toEqual(['text-size'])
  })
})

describe('checkHorizontalOverflow', () => {
  it('accepts a page as wide as the window', () => {
    expect(checkHorizontalOverflow(survey())).toEqual([])
  })

  it('rejects a page wider than the window', () => {
    expect(checksOf(checkHorizontalOverflow(survey({ scrollWidth: 1921 })))).toEqual(['horizontal-overflow'])
  })
})

describe('checkRadialFits', () => {
  const hd = { width: 1280, height: 720 }

  it('rejects a 900 px radial in a 720 px window', () => {
    expect(checksOf(checkRadialFits(survey({ viewport: hd, radial: { left: 190, top: -90, right: 1090, bottom: 810 } })))).toEqual(['radial-in-window'])
  })

  it('measures the box that carries the radial, never its ring and centre parts', () => {
    expect(RADIAL_SELECTOR).toBe('.omk-radial')
    expect(readFileSync('src/page/components/RadialMenu.vue', 'utf8')).toMatch(/<div class="omk-radial [^"]*" role="menu"/)
    expect(readFileSync('tools/capture/page-scripts.mjs', 'utf8')).not.toMatch(/radial-ring', 'radial-center'/)
  })

  it('accepts no radial and a radial inside the window', () => {
    expect(checkRadialFits(survey({ viewport: hd }))).toEqual([])
    expect(checkRadialFits(survey({ viewport: hd, radial: { left: 301, top: 21, right: 979, bottom: 699 } }))).toEqual([])
  })

  it('rejects a radial that leaves the window on any side', () => {
    for (const radial of [{ left: -1, top: 0, right: 600, bottom: 600 }, { left: 0, top: -1, right: 600, bottom: 600 }, { left: 0, top: 0, right: 1281, bottom: 600 }, { left: 0, top: 0, right: 600, bottom: 721 }]) {
      expect(checksOf(checkRadialFits(survey({ viewport: hd, radial })))).toEqual(['radial-in-window'])
    }
  })
})

describe('checkSurfaces', () => {
  it('accepts opaque surfaces with no blur and no gradient', () => {
    expect(checkSurfaces(survey({ surfaces: [surface(), surface({ surface: 'toast', backgroundColor: 'rgba(12, 11, 19, 0.9)' })] }))).toEqual([])
  })

  it('rejects a background alpha under 0.9', () => {
    const failures = checkSurfaces(survey({ surfaces: [surface({ surface: 'legend', backgroundColor: 'rgba(12, 11, 19, 0.85)' })] }))
    expect(checksOf(failures)).toEqual(['surface-alpha'])
    expect(failures[0]?.message).toContain('legend')
  })

  it('reads a color without alpha as opaque', () => {
    expect(checkSurfaces(survey({ surfaces: [surface({ backgroundColor: 'rgb(12, 11, 19)' })] }))).toEqual([])
  })

  it('rejects an opacity product under 1', () => {
    expect(checksOf(checkSurfaces(survey({ surfaces: [surface({ opacityProduct: 0.25 })] })))).toEqual(['surface-opacity'])
  })

  it('rejects backdrop-filter and a blur filter but accepts another filter', () => {
    expect(checksOf(checkSurfaces(survey({ surfaces: [surface({ backdropFilter: 'blur(4px)' })] })))).toEqual(['surface-backdrop-filter'])
    expect(checksOf(checkSurfaces(survey({ surfaces: [surface({ filter: 'blur(2px)' })] })))).toEqual(['surface-filter-blur'])
    expect(checkSurfaces(survey({ surfaces: [surface({ filter: 'brightness(1.1)' })] }))).toEqual([])
  })

  it('rejects any background image', () => {
    const image = 'linear-gradient(rgb(0, 0, 0), rgb(1, 1, 1))'
    expect(checksOf(checkSurfaces(survey({ surfaces: [surface({ backgroundImage: image })] })))).toEqual(['surface-background-image'])
  })

  it('reports each fault of each surface', () => {
    const failures = checkSurfaces(survey({ surfaces: [surface({ opacityProduct: 0.5, backdropFilter: 'blur(1px)' }), surface({ surface: 'toast', filter: 'blur(1px)' })] }))
    expect(checksOf(failures)).toEqual(['surface-opacity', 'surface-backdrop-filter', 'surface-filter-blur'])
  })
})

describe('checkColumnVeil', () => {
  const veil = 'rgba(12, 11, 19, 0.75)'

  it('accepts no column, or a column with no radial open', () => {
    expect(checkColumnVeil(survey())).toEqual([])
    expect(checkColumnVeil(survey({ column: { dimmed: false, opacityProduct: 1, veilColor: 'rgba(0, 0, 0, 0)' } }))).toEqual([])
  })

  it('accepts a column under the radial that keeps opacity 1 and carries the veil', () => {
    const radial = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(checkColumnVeil(survey({ radial, column: { dimmed: true, opacityProduct: 1, veilColor: veil } }))).toEqual([])
  })

  it('rejects a column under the radial that is not dimmed', () => {
    const radial = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(checksOf(checkColumnVeil(survey({ radial, column: { dimmed: false, opacityProduct: 1, veilColor: 'rgba(0, 0, 0, 0)' } })))).toEqual(['column-veil'])
  })

  it('rejects a dimmed column whose veil is transparent or whose opacity is under 1', () => {
    const radial = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(checksOf(checkColumnVeil(survey({ radial, column: { dimmed: true, opacityProduct: 1, veilColor: 'rgba(0, 0, 0, 0)' } })))).toEqual(['column-veil'])
    expect(checksOf(checkColumnVeil(survey({ radial, column: { dimmed: true, opacityProduct: 0.25, veilColor: veil } })))).toEqual(['column-opacity'])
  })

  it('rejects a veil that has a color but is not displayed', () => {
    const radial = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(checksOf(checkColumnVeil(survey({ radial, column: { dimmed: true, opacityProduct: 1, veilColor: veil, veilDisplay: 'none' } })))).toEqual(['column-veil'])
    expect(checkColumnVeil(survey({ radial, column: { dimmed: true, opacityProduct: 1, veilColor: veil, veilDisplay: 'block' } }))).toEqual([])
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for the same color', () => {
    expect(contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21, 5)
    expect(contrastRatio(INK, INK)).toBeCloseTo(1, 5)
  })
})

describe('checkContrast', () => {
  it('accepts the main text at 12:1 or more on the day scene', () => {
    expect(checkContrast(survey(), 'day')).toEqual([])
  })

  it('rejects main text under 12:1 on the day scene', () => {
    const failures = checkContrast(survey({ texts: [text({ text: 'Pale', color: 'rgb(120, 120, 130)' })] }), 'day')
    expect(checksOf(failures)).toEqual(['contrast'])
    expect(failures[0]?.message).toContain('Pale')
  })

  it('holds secondary text to 6:1 and accent text to 4.5:1', () => {
    const grey = 'rgb(110, 110, 120)'
    expect(checksOf(checkContrast(survey({ texts: [text({ role: 'secondary', color: grey })] }), 'day'))).toEqual(['contrast'])
    expect(checksOf(checkContrast(survey({ texts: [text({ role: 'accent', color: 'rgb(60, 50, 90)' })] }), 'day'))).toEqual(['contrast'])
    expect(checkContrast(survey({ texts: [text({ role: 'accent', color: 'rgb(143, 123, 255)' })] }), 'day')).toEqual([])
  })

  it('composites a translucent background over the one behind it', () => {
    const tinted = text({ color: 'rgb(244, 242, 249)', backgrounds: ['rgba(255, 255, 255, 0.5)', 'rgb(255, 255, 255)'] })
    expect(checksOf(checkContrast(survey({ texts: [tinted] }), 'day'))).toEqual(['contrast'])
  })

  it('holds a text outside the three roles, such as a grey written in a component, to a floor of 3:1', () => {
    const failures = checkContrast(survey({ texts: [text({ text: 'Grey', role: 'other', color: 'rgb(70, 70, 80)' })] }), 'day')
    expect(checksOf(failures)).toEqual(['contrast'])
    expect(failures[0]?.message).toContain('Grey')
    expect(checkContrast(survey({ texts: [text({ role: 'other', color: 'rgb(120, 120, 130)' })] }), 'day')).toEqual([])
  })

  it('does nothing on the night scene', () => {
    expect(checkContrast(survey({ texts: [text({ color: 'rgb(120, 120, 130)' })] }), 'night')).toEqual([])
    expect(checkContrast(survey({ texts: [text({ role: 'other', color: 'rgb(70, 70, 80)' })] }), 'night')).toEqual([])
  })
})

describe('checkDurations', () => {
  it('accepts durations up to 120 ms', () => {
    expect(checkDurations(survey({ animations: [{ selector: '.a', durationsMs: [120, 80], exempt: false }] }))).toEqual([])
  })

  it('rejects a duration over 120 ms and names the element', () => {
    const failures = checkDurations(survey({ animations: [{ selector: '.slow', durationsMs: [90, 121], exempt: false }] }))
    expect(checksOf(failures)).toEqual(['animation-duration'])
    expect(failures[0]?.message).toContain('.slow')
  })

  it('exempts the wait indicator and the hold ring', () => {
    expect(checkDurations(survey({ animations: [{ selector: '.omk-spinner', durationsMs: [800], exempt: true }] }))).toEqual([])
  })
})

describe('checkEssentialMotion', () => {
  it('accepts a hold ring that still animates under reduced motion', () => {
    expect(checkEssentialMotion(survey({ essentialAnimated: 2 }))).toEqual([])
  })

  it('rejects a hold ring that stopped under reduced motion', () => {
    expect(checksOf(checkEssentialMotion(survey({ essentialAnimated: 0 })))).toEqual(['essential-motion'])
  })
})

describe('checkConsole', () => {
  it('accepts warnings and logs', () => {
    expect(checkConsole([{ type: 'warning', text: 'w' }, { type: 'log', text: 'l' }])).toEqual([])
  })

  it('rejects console errors and uncaught page errors', () => {
    const failures = checkConsole([{ type: 'error', text: 'boom' }, { type: 'pageerror', text: 'uncaught' }])
    expect(checksOf(failures)).toEqual(['console-error', 'console-error'])
    expect(failures[0]?.message).toContain('boom')
  })
})

describe('checkReady', () => {
  it('accepts a capture that reached captureReady', () => {
    expect(checkReady(true)).toEqual([])
  })

  it('counts a capture that never reached captureReady as a failure', () => {
    expect(checksOf(checkReady(false))).toEqual(['capture-ready'])
  })
})

describe('runChecks', () => {
  const clean = { survey: survey(), scene: 'night', messages: [], ready: true }

  it('returns nothing for a conforming capture', () => {
    expect(runChecks(clean)).toEqual([])
  })

  it('runs only the ready check when the page never got ready', () => {
    expect(checksOf(runChecks({ ...clean, survey: null, ready: false }))).toEqual(['capture-ready'])
  })

  it('still reports console errors when the page never got ready', () => {
    expect(checksOf(runChecks({ ...clean, survey: null, ready: false, messages: [{ type: 'error', text: 'x' }] }))).toEqual(['capture-ready', 'console-error'])
  })

  it('checks the essential motion only for a reduced-motion capture', () => {
    const stopped = survey({ essentialAnimated: 0 })
    expect(runChecks({ ...clean, survey: stopped })).toEqual([])
    expect(checksOf(runChecks({ ...clean, survey: stopped, reducedMotion: true }))).toEqual(['essential-motion'])
  })

  it('gathers the failures of every check', () => {
    const faulty = survey({ scrollWidth: 2000, texts: [text({ fontSize: 10 })], surfaces: [surface({ opacityProduct: 0.5 })] })
    expect(checksOf(runChecks({ ...clean, survey: faulty }))).toEqual(['text-size', 'horizontal-overflow', 'surface-opacity'])
  })
})
