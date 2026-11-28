import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { RADIAL_SELECTOR, runChecks } from './capture/checks.mjs'
import { buildMatrix, captureUrl } from './capture/matrix.mjs'
import { freezePromptRing, PROMPT_RING_FRACTION, settleAnimations, surveyPage } from './capture/page-scripts.mjs'
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
      await page.evaluate(freezePromptRing, PROMPT_RING_FRACTION)
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
