import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readSource } from '../page/theme/read-source'

const manifest = readSource('omk_ui/fxmanifest.lua')
const files = ['web/index.html', 'web/assets/*', 'web/fonts/*', 'locales/*.json', 'locales/overrides/*.json', 'branding/*']

const declarationOrder = [
  "fx_version 'cerulean'",
  "game 'gta5'",
  "lua54 'yes'",
  "name 'omk_ui'",
  'description ',
  '\nversion ',
  'repository ',
  'license ',
  "shared_script 'config.lua'",
  'client_scripts',
  'server_scripts',
  "ui_page 'web/index.html'",
  'files',
]

function entriesOf(block: string): string[] {
  const body = new RegExp(`${block}\\s*\\{([^}]*)\\}`).exec(manifest)?.[1] ?? ''
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '')
}

describe('fxmanifest', () => {
  it('declares its entries in the order of the spec', () => {
    const positions = declarationOrder.map((entry) => manifest.indexOf(entry))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
  })

  it('loads the config before the exporters, and the exporters before the scripts', () => {
    expect(entriesOf('client_scripts')).toEqual(['client/config_export.lua', 'dist/client.js'])
    expect(entriesOf('server_scripts')).toEqual(['server/config_export.lua', 'dist/server.js'])
  })

  it('does not ask for a node version', () => {
    expect(manifest).not.toContain('node_version')
  })

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
