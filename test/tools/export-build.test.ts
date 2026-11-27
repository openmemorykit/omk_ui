import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportBuild } from '../../tools/export-build.mjs'
import { readSource } from '../page/theme/read-source'

const delivered = [
  'fxmanifest.lua',
  'config.lua',
  'client/config_export.lua',
  'server/config_export.lua',
  'dist/client.js',
  'dist/server.js',
  'web/index.html',
  'web/assets/a.js',
  'web/fonts/a.woff2',
  'locales/fr.json',
  'locales/overrides/.gitkeep',
  'branding/logo.png',
  'LICENSE',
  'THIRD_PARTY.md',
]
const stray = ['node_modules/vue/index.js', 'src/main.ts', 'web/main.ts', 'dist/client.js.map', 'notes.txt']

function project(missing = ''): string {
  const root = mkdtempSync(join(tmpdir(), 'omk-export-source-'))
  for (const path of delivered.filter((entry) => entry !== missing && !['LICENSE', 'THIRD_PARTY.md'].includes(entry))) {
    mkdirSync(dirname(join(root, 'omk_ui', path)), { recursive: true })
    writeFileSync(join(root, 'omk_ui', path), `content of ${path}`)
  }
  writeFileSync(join(root, 'LICENSE'), 'MIT licence')
  writeFileSync(join(root, 'THIRD_PARTY.md'), 'third party')
  return root
}

function listing(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(folder.length + 1))
    .sort()
}

function destination(): string {
  return mkdtempSync(join(tmpdir(), 'omk-export-destination-'))
}

describe('tools/export-build', () => {
  it('copies the delivered folder into <destination>/omk_ui with the licence files', () => {
    const target = destination()
    exportBuild(project(), target)
    expect(listing(join(target, 'omk_ui'))).toEqual([...delivered].sort())
  })

  it('keeps the content of every file', () => {
    const target = destination()
    exportBuild(project(), target)
    expect(readFileSync(join(target, 'omk_ui', 'web/assets/a.js'), 'utf8')).toBe('content of web/assets/a.js')
    expect(readFileSync(join(target, 'omk_ui', 'LICENSE'), 'utf8')).toBe('MIT licence')
  })

  it.each(stray)('leaves %s out of the export', (path) => {
    const root = project()
    mkdirSync(dirname(join(root, 'omk_ui', path)), { recursive: true })
    writeFileSync(join(root, 'omk_ui', path), 'x')
    const target = destination()
    exportBuild(root, target)
    expect(listing(join(target, 'omk_ui'))).not.toContain(path)
  })

  it('writes nothing outside omk_ui in the destination', () => {
    const target = destination()
    writeFileSync(join(target, 'README.md'), 'kept')
    exportBuild(project(), target)
    expect(readdirSync(target).sort()).toEqual(['README.md', 'omk_ui'])
    expect(readFileSync(join(target, 'README.md'), 'utf8')).toBe('kept')
  })

  it('removes the files of a previous export that are no longer delivered', () => {
    const target = destination()
    mkdirSync(join(target, 'omk_ui', 'web'), { recursive: true })
    writeFileSync(join(target, 'omk_ui', 'web', 'old.js'), 'old')
    exportBuild(project(), target)
    expect(listing(join(target, 'omk_ui'))).not.toContain('web/old.js')
  })

  it('creates the destination when it does not exist', () => {
    const target = join(destination(), 'nested', 'build')
    exportBuild(project(), target)
    expect(listing(join(target, 'omk_ui'))).toContain('web/index.html')
  })

  it.each(['web/index.html', 'dist/client.js', 'dist/server.js', 'fxmanifest.lua'])('refuses a delivered folder without %s and writes nothing', (path) => {
    const target = destination()
    expect(() => exportBuild(project(path), target)).toThrow(path)
    expect(readdirSync(target)).toEqual([])
  })

  it('refuses a destination inside the delivered folder', () => {
    const root = project()
    expect(() => exportBuild(root, join(root, 'omk_ui', 'web'))).toThrow('destination')
  })

  it('refuses the source project itself as destination', () => {
    const root = project()
    expect(() => exportBuild(root, root)).toThrow('destination')
  })

  it('exports from the command line to the destination argument', () => {
    const target = destination()
    const run = spawnSync('node', [join(process.cwd(), 'tools/export-build.mjs'), target], { cwd: project(), encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(listing(join(target, 'omk_ui'))).toContain('web/index.html')
  })

  it('fails from the command line without a destination', () => {
    const run = spawnSync('node', [join(process.cwd(), 'tools/export-build.mjs')], { cwd: project(), encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('destination')
  })

  it('fails from the command line when the page is missing', () => {
    const run = spawnSync('node', [join(process.cwd(), 'tools/export-build.mjs'), destination()], { cwd: project('web/index.html'), encoding: 'utf8' })
    expect(run.status).toBe(1)
  })

  it('has no default path and names no private repository', () => {
    const source = readSource('tools/export-build.mjs')
    expect(source).not.toContain('/home/')
    expect(source).not.toContain('omk-ui-build')
  })
})

describe('export-build script', () => {
  it('is an npm script that takes the destination as argument', () => {
    const scripts = (JSON.parse(readSource('package.json')) as { scripts: Record<string, string> }).scripts
    expect(scripts['export-build']).toBe('node tools/export-build.mjs')
  })
})
