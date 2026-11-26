import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readSource } from '../page/theme/read-source'

const manifest = readSource('omk_ui/fxmanifest.lua')
const files = ['web/index.html', 'web/assets/*', 'web/fonts/*', 'locales/*.json', 'locales/overrides/*.json', 'branding/*']

describe('fxmanifest', () => {
  it('serves the page from web/index.html', () => {
    expect(manifest).toContain("ui_page 'web/index.html'")
  })

  it('lists every delivered file pattern', () => {
    const block = /files\s*\{([^}]*)\}/.exec(manifest)?.[1] ?? ''
    const listed = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1])
    expect(listed).toEqual(files)
  })

  it.each(['omk_ui/locales/overrides/.gitkeep', 'omk_ui/branding/.gitkeep'])('keeps %s so the folder survives git', (path) => {
    expect(existsSync(path)).toBe(true)
  })
})
