const MIN_TEXT_PX_FULL_HD = 16
const MIN_TEXT_PX_HD = 14.4
const FULL_HD_HEIGHT = 1080
const TEXT_TOLERANCE_PX = 0.01
const MIN_SURFACE_ALPHA = 0.9
const MAX_DURATION_MS = 120
const OPAQUE = 1
const CONTRAST_TARGETS = new Map([['primary', 12], ['secondary', 6], ['accent', 4.5], ['other', 3]])
const COLOR_PATTERN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/
const BLACK = { red: 0, green: 0, blue: 0, alpha: 1 }
const WHITE = { red: 255, green: 255, blue: 255, alpha: 1 }
const CHANNEL_MAX = 255
const LINEAR_THRESHOLD = 0.03928
const LINEAR_DIVISOR = 12.92
const LINEAR_OFFSET = 0.055
const LINEAR_SCALE = 1.055
const LINEAR_GAMMA = 2.4
const LUMA = { red: 0.2126, green: 0.7152, blue: 0.0722 }
const LUMINANCE_PAD = 0.05
const PERCENT = 100
const DAY = 'day'
const CONSOLE_ERROR_TYPES = new Set(['error', 'pageerror'])

export const RADIAL_SELECTOR = '.omk-radial'

const failure = (check, message) => ({ check, message })

function parseAlpha(raw) {
  if (raw === undefined) return 1
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / PERCENT : Number(raw)
}

export function parseColor(value) {
  const match = COLOR_PATTERN.exec(String(value).trim())
  if (match === null) return null
  return { red: Number(match[1]), green: Number(match[2]), blue: Number(match[3]), alpha: parseAlpha(match[4]) }
}

function compositeOver(top, bottom) {
  const alpha = top.alpha + bottom.alpha * (1 - top.alpha)
  const mix = (a, b) => (a * top.alpha + b * bottom.alpha * (1 - top.alpha)) / alpha
  return { red: mix(top.red, bottom.red), green: mix(top.green, bottom.green), blue: mix(top.blue, bottom.blue), alpha }
}

function luminance(color) {
  const channel = (value) => {
    const unit = value / CHANNEL_MAX
    return unit <= LINEAR_THRESHOLD ? unit / LINEAR_DIVISOR : ((unit + LINEAR_OFFSET) / LINEAR_SCALE) ** LINEAR_GAMMA
  }
  return LUMA.red * channel(color.red) + LUMA.green * channel(color.green) + LUMA.blue * channel(color.blue)
}

function ratioOf(foreground, background) {
  const high = Math.max(luminance(foreground), luminance(background))
  const low = Math.min(luminance(foreground), luminance(background))
  return (high + LUMINANCE_PAD) / (low + LUMINANCE_PAD)
}

export function contrastRatio(foreground, background) {
  return ratioOf(parseColor(foreground) ?? BLACK, parseColor(background) ?? WHITE)
}

function effectiveBackground(backgrounds) {
  const layers = backgrounds.map(parseColor).filter((color) => color !== null && color.alpha > 0)
  return layers.reduceRight((below, layer) => compositeOver(layer, below), WHITE)
}

export function checkTextSize(survey) {
  const minimum = survey.viewport.height >= FULL_HD_HEIGHT ? MIN_TEXT_PX_FULL_HD : MIN_TEXT_PX_HD
  return survey.texts
    .filter((entry) => entry.fontSize + TEXT_TOLERANCE_PX < minimum)
    .map((entry) => failure('text-size', `"${entry.text}" is ${entry.fontSize} px, under ${minimum} px`))
}

export function checkHorizontalOverflow(survey) {
  return survey.scrollWidth > survey.viewport.width
    ? [failure('horizontal-overflow', `page is ${survey.scrollWidth} px wide in a ${survey.viewport.width} px window`)]
    : []
}

export function checkRadialFits(survey) {
  const box = survey.radial
  const inside = box === null || (box.left >= 0 && box.top >= 0 && box.right <= survey.viewport.width && box.bottom <= survey.viewport.height)
  return inside ? [] : [failure('radial-in-window', `radial box leaves the ${survey.viewport.width}x${survey.viewport.height} window`)]
}

function surfaceFailures(entry) {
  const color = parseColor(entry.backgroundColor)
  const problems = []
  if (color === null || color.alpha < MIN_SURFACE_ALPHA) problems.push(failure('surface-alpha', `${entry.surface} background alpha is ${color?.alpha ?? 'unreadable'}, under ${MIN_SURFACE_ALPHA}`))
  if (entry.opacityProduct !== OPAQUE) problems.push(failure('surface-opacity', `${entry.surface} opacity product is ${entry.opacityProduct}`))
  if (entry.backdropFilter !== 'none') problems.push(failure('surface-backdrop-filter', `${entry.surface} has backdrop-filter ${entry.backdropFilter}`))
  if (entry.filter.includes('blur')) problems.push(failure('surface-filter-blur', `${entry.surface} has filter ${entry.filter}`))
  if (entry.backgroundImage !== 'none') problems.push(failure('surface-background-image', `${entry.surface} has background-image ${entry.backgroundImage}`))
  return problems
}

export function checkSurfaces(survey) {
  return survey.surfaces.flatMap(surfaceFailures)
}

export function checkColumnVeil(survey) {
  const column = survey.column
  if (survey.radial === null || column === null) return []
  const veil = parseColor(column.veilColor)
  const veiled = column.dimmed && veil !== null && veil.alpha > 0 && column.veilDisplay !== 'none'
  const problems = veiled ? [] : [failure('column-veil', 'column behind the radial has no --dim-veil')]
  if (column.opacityProduct !== OPAQUE) problems.push(failure('column-opacity', `column behind the radial has opacity ${column.opacityProduct}`))
  return problems
}

export function checkContrast(survey, scene) {
  if (scene !== DAY) return []
  return survey.texts.flatMap((entry) => {
    const target = CONTRAST_TARGETS.get(entry.role)
    const foreground = parseColor(entry.color)
    if (target === undefined || foreground === null) return []
    const background = effectiveBackground(entry.backgrounds)
    const ratio = ratioOf(compositeOver(foreground, background), background)
    return ratio < target ? [failure('contrast', `"${entry.text}" (${entry.role}) is ${ratio.toFixed(2)}:1, under ${target}:1`)] : []
  })
}

export function checkDurations(survey) {
  return survey.animations
    .filter((entry) => !entry.exempt && entry.durationsMs.some((duration) => duration > MAX_DURATION_MS))
    .map((entry) => failure('animation-duration', `${entry.selector} runs ${Math.max(...entry.durationsMs)} ms, over ${MAX_DURATION_MS} ms`))
}

export function checkEssentialMotion(survey) {
  return survey.essentialAnimated > 0 ? [] : [failure('essential-motion', 'hold ring and wait indicator stopped under prefers-reduced-motion')]
}

export function checkConsole(messages) {
  return messages.filter((message) => CONSOLE_ERROR_TYPES.has(message.type)).map((message) => failure('console-error', message.text))
}

export function checkReady(ready) {
  return ready ? [] : [failure('capture-ready', 'captureReady was not reached before the time limit')]
}

export function runChecks({ survey, scene, messages, ready, reducedMotion = false }) {
  const pageChecks = ready && survey !== null
    ? [checkTextSize, checkHorizontalOverflow, checkRadialFits, checkSurfaces, checkColumnVeil, (entry) => checkContrast(entry, scene), checkDurations, ...(reducedMotion ? [checkEssentialMotion] : [])].flatMap((check) => check(survey))
    : []
  return [...checkReady(ready), ...pageChecks, ...checkConsole(messages)]
}
