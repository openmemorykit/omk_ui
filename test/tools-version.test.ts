import { describe, expect, it } from 'vitest'
import { checkVersions, manifestVersion } from '../tools/version.mjs'

const manifest = "fx_version 'cerulean'\nname 'omk_ui'\nversion '0.1.0'\n"

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
})
