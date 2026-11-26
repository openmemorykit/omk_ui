import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { archiveName, buildArchive } from '../../tools/release.mjs'

function project(withPage = true): string {
  const root = mkdtempSync(join(tmpdir(), 'omk-release-'))
  mkdirSync(join(root, 'omk_ui', 'web', 'assets'), { recursive: true })
  mkdirSync(join(root, 'omk_ui', 'locales', 'overrides'), { recursive: true })
  writeFileSync(join(root, 'omk_ui', 'fxmanifest.lua'), "version '0.1.0'\n")
  writeFileSync(join(root, 'omk_ui', 'locales', 'fr.json'), '{}')
  writeFileSync(join(root, 'omk_ui', 'locales', 'overrides', '.gitkeep'), '')
  if (withPage) writeFileSync(join(root, 'omk_ui', 'web', 'index.html'), '<!doctype html>')
  writeFileSync(join(root, 'omk_ui', 'web', 'assets', 'a.js'), 'x')
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
    for (const name of ['omk_ui/fxmanifest.lua', 'omk_ui/web/index.html', 'omk_ui/LICENSE', 'omk_ui/THIRD_PARTY.md', 'omk_ui/locales/overrides/.gitkeep']) {
      expect(listing).toContain(name)
    }
  })

  it('does not touch the working tree to add the licence files', () => {
    const root = project()
    buildArchive(root)
    expect(spawnSync('ls', [join(root, 'omk_ui')], { encoding: 'utf8' }).stdout).not.toContain('LICENSE')
  })

  it('refuses a delivered folder without its page', () => {
    expect(() => buildArchive(project(false))).toThrow(/web\/index\.html/)
  })

  it('writes release/omk_ui-<version>.zip from the command line', () => {
    const root = project()
    const run = spawnSync('node', [join(process.cwd(), 'tools/release.mjs')], { cwd: root, encoding: 'utf8' })
    expect(run.status).toBe(0)
    const archive = readFileSync(join(root, 'release', 'omk_ui-0.1.0.zip'))
    expect(names(archive)).toContain('omk_ui/web/index.html')
  })

  it('fails from the command line when the page is missing', () => {
    expect(spawnSync('node', [join(process.cwd(), 'tools/release.mjs')], { cwd: project(false) }).status).toBe(1)
  })
})
