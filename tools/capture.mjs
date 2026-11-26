import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { RADIAL_SELECTOR, runChecks } from './capture/checks.mjs'
import { buildMatrix, captureUrl } from './capture/matrix.mjs'
import { serveStatic } from './capture/serve.mjs'

const PLAYWRIGHT_MODULE = '/pw'
const DEFAULT_ROOT = '.preview-dist'
const DEFAULT_OUT = 'test/captures'
const REPORT_FILE = 'report.json'
const READY_LIMIT_MS = 10_000
const REPORT_INDENT = 2
const ARGUMENT = /^--(root|out|only)=(.+)$/

function readOptions(argv) {
  const entries = argv.map((arg) => ARGUMENT.exec(arg)).filter((match) => match !== null).map((match) => [match[1], match[2]])
  const options = Object.fromEntries(entries)
  return { root: resolve(options.root ?? DEFAULT_ROOT), out: resolve(options.out ?? DEFAULT_OUT), only: options.only ?? '' }
}

function surveyPage(radialSelector) {
  const SKIPPED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
  const ESSENTIAL = '[data-motion="essential"], .omk-spinner'
  const MS_PER_SECOND = 1000
  const ALPHA_OPAQUE = 1
  const colorOf = (token) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${token})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }
  const roleColors = new Map([[colorOf('--ink'), 'primary'], [colorOf('--ink-2'), 'secondary'], [colorOf('--ink-3'), 'secondary'], [colorOf('--accent-text'), 'accent']])
  const alphaOf = (color) => {
    const match = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)
    return match === null ? ALPHA_OPAQUE : Number(match[1])
  }
  const opacityProduct = (element) => {
    let product = 1
    for (let node = element; node !== null; node = node.parentElement) product *= Number(getComputedStyle(node).opacity)
    return product
  }
  const backgroundsOf = (element) => {
    const layers = []
    for (let node = element; node !== null; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor
      const alpha = alphaOf(color)
      if (alpha > 0) layers.push(color)
      if (alpha === ALPHA_OPAQUE) break
    }
    return layers
  }
  const isPreviewChrome = (element) => element.closest('[data-surface^="preview-"]:not([data-surface="preview-scene"])') !== null
  const visible = (element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.display !== 'none'
  }

  const texts = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const element = node.parentElement
    const content = node.textContent.trim()
    if (element === null || content === '' || SKIPPED.has(element.tagName) || isPreviewChrome(element) || !visible(element) || opacityProduct(element) === 0) continue
    const style = getComputedStyle(element)
    texts.push({ text: content.slice(0, 40), fontSize: parseFloat(style.fontSize), role: roleColors.get(style.color) ?? 'other', color: style.color, backgrounds: backgroundsOf(element) })
  }

  const surfaces = [...document.querySelectorAll('[data-surface]')].filter((element) => !isPreviewChrome(element) && element.dataset.surface !== 'preview-scene' && visible(element)).map((element) => {
    const style = getComputedStyle(element)
    return { surface: element.dataset.surface, backgroundColor: style.backgroundColor, opacityProduct: opacityProduct(element), backdropFilter: style.backdropFilter || 'none', filter: style.filter, backgroundImage: style.backgroundImage }
  })

  const boxOf = (element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
  }
  const radialElement = document.querySelector(radialSelector)
  const radial = radialElement === null ? null : boxOf(radialElement)
  const columnElement = document.querySelector('[data-surface="column"]')
  const column = columnElement === null ? null : {
    dimmed: columnElement.hasAttribute('data-dimmed'),
    opacityProduct: opacityProduct(columnElement),
    veilColor: getComputedStyle(columnElement, '::after').backgroundColor,
  }

  const toMs = (list) => list.split(',').map((item) => (item.trim().endsWith('ms') ? parseFloat(item) : parseFloat(item) * MS_PER_SECOND))
  const animations = []
  let essentialAnimated = 0
  for (const element of document.querySelectorAll('*')) {
    const style = getComputedStyle(element)
    const animated = style.animationName !== 'none'
    const durationsMs = [...(animated ? toMs(style.animationDuration) : []), ...toMs(style.transitionDuration)].filter((duration) => duration > 0)
    const exempt = element.closest(ESSENTIAL) !== null
    if (animated && exempt && element.matches(ESSENTIAL)) essentialAnimated += 1
    if (durationsMs.length > 0) animations.push({ selector: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`, durationsMs, exempt })
  }

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    texts,
    surfaces,
    radial,
    column,
    animations,
    essentialAnimated,
  }
}

async function settleAnimations() {
  const ESSENTIAL = '[data-motion="essential"], .omk-spinner'
  const finite = document.getAnimations().filter((animation) => {
    const target = animation.effect?.target
    return animation.effect?.getComputedTiming().iterations !== Infinity && !(target instanceof Element && target.closest(ESSENTIAL) !== null)
  })
  await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)))
}

async function capturePage(browser, base, out, capture) {
  const deadline = Date.now() + READY_LIMIT_MS
  const remaining = () => Math.max(1, deadline - Date.now())
  const context = await browser.newContext({
    viewport: { width: capture.width, height: capture.height },
    deviceScaleFactor: 1,
    reducedMotion: capture.reducedMotion ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()
  const messages = []
  page.on('console', (message) => messages.push({ type: message.type(), text: message.text() }))
  page.on('pageerror', (error) => messages.push({ type: 'pageerror', text: error.message }))
  let ready = false
  let survey = null
  const failures = []
  try {
    await page.goto(`${base}${captureUrl(capture)}`, { timeout: remaining(), waitUntil: 'load' })
    ready = await page.waitForFunction(() => document.documentElement.dataset.captureReady === 'true', undefined, { timeout: remaining(), polling: 'raf' }).then(() => true, () => false)
    if (ready) {
      await page.evaluate(settleAnimations)
      survey = await page.evaluate(surveyPage, RADIAL_SELECTOR)
    }
  } catch (error) {
    failures.push({ check: 'capture-error', message: String(error instanceof Error ? error.message : error).split('\n')[0] })
  }
  await page.screenshot({ path: join(out, capture.file) }).catch((error) => failures.push({ check: 'screenshot-error', message: String(error.message).split('\n')[0] }))
  await context.close()
  const checked = runChecks({ survey, scene: capture.scene, messages, ready, reducedMotion: capture.reducedMotion })
  return { name: capture.name, file: capture.file, ready, failures: [...failures, ...checked] }
}

async function main() {
  const { root, out, only } = readOptions(process.argv.slice(2))
  const captures = buildMatrix().filter((capture) => capture.name.includes(only))
  mkdirSync(out, { recursive: true })
  const { chromium } = createRequire(import.meta.url)(PLAYWRIGHT_MODULE)
  const server = await serveStatic(root, 0)
  const browser = await chromium.launch()
  const results = []
  try {
    for (const capture of captures) {
      const result = await capturePage(browser, `http://127.0.0.1:${server.port}`, out, capture)
      results.push(result)
      console.log(`${result.failures.length === 0 ? 'ok  ' : 'FAIL'} ${result.name}${result.failures.map((item) => `\n       ${item.check}: ${item.message}`).join('')}`)
    }
  } finally {
    await browser.close()
    await server.close()
  }
  const failed = results.filter((result) => result.failures.length > 0).length
  writeFileSync(join(out, REPORT_FILE), `${JSON.stringify({ total: results.length, passed: results.length - failed, failed, captures: results }, null, REPORT_INDENT)}\n`)
  console.log(`${results.length - failed}/${results.length} captures without failure, report in ${join(out, REPORT_FILE)}`)
  process.exitCode = failed === 0 ? 0 : 1
}

await main()
