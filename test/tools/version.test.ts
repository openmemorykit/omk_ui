import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { checkVersions, manifestVersion, writeManifestVersion } from '../../tools/version.mjs'

const manifest = "fx_version 'cerulean'\nname 'omk_ui'\nversion '0.1.0'\n"
const script = join(process.cwd(), 'tools/version.mjs')

function workspace(manifestText: string, packageVersion: string): string {
  const root = mkdtempSync(join(tmpdir(), 'omk-version-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: packageVersion }))
  mkdirSync(join(root, 'omk_ui'))
  writeFileSync(join(root, 'omk_ui', 'fxmanifest.lua'), manifestText)
  return root
}

describe('tools/version', () => {
  it('reads the manifest version', () => {
    expect(manifestVersion(manifest)).toBe('0.1.0')
  })

  it('accepts matching versions', () => {
    expect(checkVersions(manifest, '{"version":"0.1.0"}')).toBeUndefined()
  })

  it('reports a mismatch', () => {
    expect(checkVersions(manifest, '{"version":"0.2.0"}')).toContain('0.2.0')
  })

  it('reports a missing manifest version', () => {
    expect(checkVersions("name 'omk_ui'\n", '{"version":"0.1.0"}')).toContain('undefined')
  })

  it('writes the package version into the manifest and keeps the other lines', () => {
    const written = writeManifestVersion(manifest, '0.2.0')
    expect(written).toBe("fx_version 'cerulean'\nname 'omk_ui'\nversion '0.2.0'\n")
    expect(checkVersions(written ?? '', '{"version":"0.2.0"}')).toBeUndefined()
  })

  it('refuses to write into a manifest without a version line', () => {
    expect(writeManifestVersion("name 'omk_ui'\n", '0.2.0')).toBeUndefined()
  })

  it('verifies when run directly, and fails on a mismatch', () => {
    const root = workspace(manifest, '0.2.0')
    const run = spawnSync('node', [script], { cwd: root, encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('0.2.0')
  })

  it('writes then verifies when run directly with --write', () => {
    const root = workspace(manifest, '0.2.0')
    const write = spawnSync('node', [script, '--write'], { cwd: root, encoding: 'utf8' })
    expect(write.status).toBe(0)
    expect(readFileSync(join(root, 'omk_ui', 'fxmanifest.lua'), 'utf8')).toContain("version '0.2.0'")
    expect(spawnSync('node', [script], { cwd: root }).status).toBe(0)
  })
})
