import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { archiveName, buildArchive } from '../../tools/release.mjs'

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
  'locales/overrides/server.json',
  'branding/.gitkeep',
  'branding/logo.png',
]
const stray = ['notes.txt', 'web/.DS_Store', 'dist/client.js.map', 'client/main.lua', 'locales/draft.txt', 'locales/overrides/draft.txt', 'src/main.ts']

function project(missing = ''): string {
  const root = mkdtempSync(join(tmpdir(), 'omk-release-'))
  for (const path of delivered.filter((entry) => entry !== missing)) {
    mkdirSync(dirname(join(root, 'omk_ui', path)), { recursive: true })
    writeFileSync(join(root, 'omk_ui', path), path === 'fxmanifest.lua' ? "version '0.1.0'\n" : 'x')
  }
  writeFileSync(join(root, 'LICENSE'), 'MIT licence')
  writeFileSync(join(root, 'THIRD_PARTY.md'), 'tiers')
  writeFileSync(join(root, 'package.json'), '{"version":"0.1.0"}')
  return root
}

function names(zip: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), 'omk-release-list-'))
  writeFileSync(join(dir, 'a.zip'), zip)
  return spawnSync('unzip', ['-l', join(dir, 'a.zip')], { encoding: 'utf8' }).stdout
}

describe('tools/release', () => {
  it('names the archive after the version', () => {
    expect(archiveName('0.1.0')).toBe('omk_ui-0.1.0.zip')
  })

  it('lists the delivered folder with the licence and third-party notices at its root', () => {
    const listing = names(buildArchive(project()))
    for (const name of [...delivered.map((path) => `omk_ui/${path}`), 'omk_ui/LICENSE', 'omk_ui/THIRD_PARTY.md']) {
      expect(listing).toContain(name)
    }
  })

  it('needs unzip to read the archive back', () => {
    expect(spawnSync('unzip', ['-v']).error).toBeUndefined()
  })

  it.each(stray)('leaves %s out of the archive', (path) => {
    const root = project()
    mkdirSync(dirname(join(root, 'omk_ui', path)), { recursive: true })
    writeFileSync(join(root, 'omk_ui', path), 'x')
    expect(names(buildArchive(root))).not.toContain(path)
  })

  it('does not touch the working tree to add the licence files', () => {
    const root = project()
    buildArchive(root)
    expect(spawnSync('ls', [join(root, 'omk_ui')], { encoding: 'utf8' }).stdout).not.toContain('LICENSE')
  })

  it.each(['web/index.html', 'dist/client.js', 'dist/server.js', 'config.lua', 'client/config_export.lua', 'server/config_export.lua', 'fxmanifest.lua'])('refuses a delivered folder without %s', (path) => {
    expect(() => buildArchive(project(path))).toThrow(path)
  })

  it('writes release/omk_ui-<version>.zip from the command line', () => {
    const root = project()
    const run = spawnSync('node', [join(process.cwd(), 'tools/release.mjs')], { cwd: root, encoding: 'utf8' })
    expect(run.status).toBe(0)
    const archive = readFileSync(join(root, 'release', 'omk_ui-0.1.0.zip'))
    expect(names(archive)).toContain('omk_ui/web/index.html')
  })

  it('fails from the command line when the page is missing', () => {
    expect(spawnSync('node', [join(process.cwd(), 'tools/release.mjs')], { cwd: project('web/index.html') }).status).toBe(1)
  })
})
