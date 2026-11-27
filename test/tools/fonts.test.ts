import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyFonts, licenseName } from '../../tools/fonts.mjs'

const manifest = {
  alpha: { cssName: 'Alpha', package: '@scope/alpha', weights: { '500': 'alpha-latin-500-normal.woff2' } },
  beta: { cssName: 'Beta', package: '@scope/beta', weights: { '700': 'beta-latin-700-normal.woff2' } },
}

function fakeSources(): string {
  const root = mkdtempSync(join(tmpdir(), 'omk-fonts-src-'))
  for (const family of Object.values(manifest)) {
    const files = join(root, family.package, 'files')
    mkdirSync(files, { recursive: true })
    writeFileSync(join(root, family.package, 'LICENSE'), `licence ${family.cssName}`)
    for (const name of [...Object.values(family.weights), 'x-latin-ext-500-normal.woff2', 'x-latin-500-normal.woff']) {
      writeFileSync(join(files, name), name)
    }
  }
  return root
}

describe('tools/fonts', () => {
  it('copies only the listed latin files and one OFL text per family', () => {
    const target = join(mkdtempSync(join(tmpdir(), 'omk-fonts-out-')), 'fonts')
    const result = copyFonts(manifest, fakeSources(), target)
    expect(result.missing).toEqual([])
    expect(readdirSync(target).sort()).toEqual(['alpha-OFL.txt', 'alpha-latin-500-normal.woff2', 'beta-OFL.txt', 'beta-latin-700-normal.woff2'])
    expect(readFileSync(join(target, 'alpha-OFL.txt'), 'utf8')).toBe('licence Alpha')
  })

  it('removes files left by an earlier run', () => {
    const target = mkdtempSync(join(tmpdir(), 'omk-fonts-old-'))
    writeFileSync(join(target, 'old.woff2'), 'old')
    copyFonts(manifest, fakeSources(), target)
    expect(existsSync(join(target, 'old.woff2'))).toBe(false)
  })

  it('reports files that are not in the package instead of throwing', () => {
    const target = join(mkdtempSync(join(tmpdir(), 'omk-fonts-out-')), 'fonts')
    const result = copyFonts(manifest, mkdtempSync(join(tmpdir(), 'omk-fonts-empty-')), target)
    expect(result.copied).toEqual([])
    expect(result.missing).toHaveLength(4)
  })

  it('names the licence after the package', () => {
    expect(licenseName('@fontsource/archivo-narrow')).toBe('archivo-narrow-OFL.txt')
  })
})
