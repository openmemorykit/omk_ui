import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/shared/config/config-schema'
import { readSource } from '../page/theme/read-source'

type LuaValue = string | number | boolean | null | readonly LuaValue[]
interface LuaTable { readonly [key: string]: LuaTable | LuaValue }

const SHARED_CONFIG_LINE = /^(\w+)\s*=\s*(.*?),?$/
const SECTION_START = /^(\w+)\s*=\s*\{$/
const SECTION_END = /^\},?$/
const QUOTED = /^'(.*)'$/
const EXPORTER = "exports('getConfig', function() return Config end)"

function parseValue(text: string): LuaValue {
  if (text === 'nil') return null
  if (text === 'true' || text === 'false') return text === 'true'
  if (text === '{}') return []
  const quoted = QUOTED.exec(text)
  return quoted === null ? Number(text) : (quoted[1] ?? '')
}

function parseConfig(source: string): LuaTable {
  const config: Record<string, Record<string, LuaValue>> = {}
  let section: Record<string, LuaValue> | null = null
  for (const rawLine of source.split('\n')) {
    const line = rawLine.replace(/\s+--.*$/, '').trim()
    const start = SECTION_START.exec(line)
    if (start !== null && start[1] !== 'Config') {
      section = {}
      config[start[1] ?? ''] = section
    } else if (SECTION_END.test(line)) section = null
    else if (section !== null) {
      const entry = SHARED_CONFIG_LINE.exec(line)
      if (entry !== null) section[entry[1] ?? ''] = parseValue(entry[2] ?? '')
    }
  }
  return config
}

describe('config.lua', () => {
  it('declares the global Config table that both exporters return', () => {
    expect(readSource('omk_ui/config.lua')).toMatch(/^Config\s*=\s*\{$/m)
  })

  it('repeats every key of KitConfig with its default value', () => {
    expect(parseConfig(readSource('omk_ui/config.lua'))).toEqual(JSON.parse(JSON.stringify(DEFAULT_CONFIG)))
  })
})

describe.each(['client', 'server'])('%s/config_export.lua', (side) => {
  it('exports Config through getConfig', () => {
    expect(readFileSync(`omk_ui/${side}/config_export.lua`, 'utf8').trim()).toBe(EXPORTER)
  })
})

describe('git and CI files', () => {
  it('ignores the built scripts, which the archive delivers', () => {
    expect(readSource('.gitignore').split('\n')).toContain('omk_ui/dist/')
  })

  it('checks the Lua syntax in a job of its own', () => {
    const workflow = readSource('.github/workflows/check.yml')
    expect(workflow).toContain('luac5.4 -p omk_ui/config.lua omk_ui/client/config_export.lua omk_ui/server/config_export.lua')
    expect(workflow).toContain('node:22-alpine')
  })
})
