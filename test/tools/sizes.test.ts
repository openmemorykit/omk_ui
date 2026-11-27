import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUDGETS, checkSizes, collectFiles } from '../../tools/sizes.mjs'

interface Entry { readonly path: string; readonly data: Buffer }

const KILO = 1000
const file = (path: string, bytes: number, fill = 'a'): Entry => ({ path, data: Buffer.alloc(bytes, fill) })
const noise = (path: string, bytes: number): Entry => ({ path, data: randomBytes(bytes) })
const text = (path: string, content: string): Entry => ({ path, data: Buffer.from(content) })
const baseline = (): Entry[] => [
  text('index.html', '<!doctype html>'),
  file('assets/index-1.js', 50 * KILO),
  file('assets/index-1.css', 10 * KILO),
  file('fonts/alpha-latin-500-normal.woff2', 30 * KILO),
  file('fonts/alpha-latin-700-normal.woff2', 30 * KILO),
  file('fonts/beta-latin-500-normal.woff2', 30 * KILO),
  text('fonts/alpha-OFL.txt', 'licence'),
]
const errorsOf = (files: Entry[]): string[] => checkSizes(files).errors

describe('tools/sizes', () => {
  it('budgets 170 Ko of raw JS and 60 Ko of gzip JS', () => {
    expect(BUDGETS.jsBytes).toBe(170 * KILO)
    expect(BUDGETS.jsGzipBytes).toBe(60 * KILO)
  })

  it('accepts a build inside every budget and prints one line per measure', () => {
    const result = checkSizes(baseline())
    expect(result.errors).toEqual([])
    expect(result.report.length).toBeGreaterThanOrEqual(4)
  })

  it('sums the js of every file of assets', () => {
    const files = [...baseline(), file('assets/chunk-2.js', BUDGETS.jsBytes)]
    expect(errorsOf(files).join('\n')).toContain('JS')
  })

  it('accepts js exactly at the minified budget and refuses one byte more', () => {
    const base = baseline().filter((entry) => !entry.path.endsWith('.js'))
    expect(errorsOf([...base, file('assets/a.js', BUDGETS.jsBytes)])).toEqual([])
    expect(errorsOf([...base, file('assets/a.js', BUDGETS.jsBytes + 1)])).not.toEqual([])
  })

  it('refuses js over the gzip budget even when the minified size fits', () => {
    const base = baseline().filter((entry) => !entry.path.endsWith('.js'))
    const errors = errorsOf([...base, noise('assets/a.js', BUDGETS.jsGzipBytes + KILO)])
    expect(errors.join('\n')).toContain('gzip')
  })

  it('accepts incompressible js under the gzip budget', () => {
    const base = baseline().filter((entry) => !entry.path.endsWith('.js'))
    expect(errorsOf([...base, noise('assets/a.js', BUDGETS.jsGzipBytes - KILO)])).toEqual([])
  })

  it('refuses css over its budget and accepts it at the budget', () => {
    const base = baseline().filter((entry) => !entry.path.endsWith('.css'))
    expect(errorsOf([...base, file('assets/a.css', BUDGETS.cssBytes)])).toEqual([])
    expect(errorsOf([...base, file('assets/a.css', BUDGETS.cssBytes + 1)]).join('\n')).toContain('CSS')
  })

  it('refuses fonts over the byte budget, licences included', () => {
    const base = baseline().filter((entry) => !entry.path.startsWith('fonts/'))
    const fits = [file('fonts/alpha-latin-500-normal.woff2', BUDGETS.fontBytes - 10), text('fonts/alpha-OFL.txt', '0123456789')]
    expect(errorsOf([...base, ...fits])).toEqual([])
    const over = [file('fonts/alpha-latin-500-normal.woff2', BUDGETS.fontBytes - 10), text('fonts/alpha-OFL.txt', '0123456789a')]
    expect(errorsOf([...base, ...over]).join('\n')).toContain('polices')
  })

  it('refuses more than two font families', () => {
    const files = [...baseline(), file('fonts/gamma-latin-500-normal.woff2', KILO)]
    expect(errorsOf(files).join('\n')).toContain('familles')
  })

  it('counts a family once however many weights it has', () => {
    expect(errorsOf(baseline())).toEqual([])
  })

  it('refuses any file containing data-omk-preview', () => {
    const files = [...baseline(), text('assets/leak.js', 'x;document.body.dataset["data-omk-preview"]')]
    const errors = errorsOf(files)
    expect(errors.join('\n')).toContain('data-omk-preview')
    expect(errors.join('\n')).toContain('assets/leak.js')
  })

  it('refuses data-omk-preview in the html too', () => {
    expect(errorsOf([...baseline(), text('index.html', '<div data-omk-preview>')]).join('\n')).toContain('index.html')
  })

  it('refuses ~standard in assets', () => {
    const errors = errorsOf([...baseline(), text('assets/valibot.js', 'schema["~standard"]')])
    expect(errors.join('\n')).toContain('~standard')
  })

  it('does not look for ~standard outside assets', () => {
    expect(errorsOf([...baseline(), text('index.html', '~standard')])).toEqual([])
  })

  it('collects files recursively with posix relative paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'omk-sizes-'))
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'index.html'), 'x')
    writeFileSync(join(root, 'assets', 'a.js'), 'yy')
    const collected = collectFiles(root).map((entry: Entry) => [entry.path, entry.data.length])
    expect(collected.sort()).toEqual([['assets/a.js', 2], ['index.html', 1]])
  })

  it('runs from the command line: prints the measures, exits 1 over a budget', () => {
    const root = mkdtempSync(join(tmpdir(), 'omk-sizes-cli-'))
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets', 'a.js'), 'x')
    const script = join(process.cwd(), 'tools/sizes.mjs')
    const ok = spawnSync('node', [script, root], { encoding: 'utf8' })
    expect(ok.status).toBe(0)
    expect(ok.stdout).toContain('JS')
    writeFileSync(join(root, 'assets', 'b.js'), Buffer.alloc(BUDGETS.jsBytes))
    const bad = spawnSync('node', [script, root], { encoding: 'utf8' })
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain('JS')
  })

  it('fails when the folder does not exist', () => {
    expect(spawnSync('node', [join(process.cwd(), 'tools/sizes.mjs'), '/nonexistent-omk']).status).toBe(1)
  })
})
