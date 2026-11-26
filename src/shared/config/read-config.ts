import { normalizePayload } from '@openmemorykit/ui/validation'
import * as v from 'valibot'
import type { ValueOf } from '@openmemorykit/core/shared'
import { DEFAULT_CONFIG, INPUT_FIELDS, THEME_FIELDS, TRACE_FIELDS, type KitConfig } from './config-schema'

export const ConfigWarningKind = { Invalid: 'invalid', Unknown: 'unknown' } as const
export type ConfigWarningKind = ValueOf<typeof ConfigWarningKind>

export interface ConfigWarning {
  readonly key: string
  readonly kind: ConfigWarningKind
}
export interface ConfigReading {
  readonly config: KitConfig
  readonly warnings: readonly ConfigWarning[]
}

type Fields = Readonly<Record<string, v.GenericSchema>>
type Table = Readonly<Record<string, unknown>>

const SECTIONS = new Map<string, Fields>([
  ['theme', THEME_FIELDS],
  ['input', INPUT_FIELDS],
  ['trace', TRACE_FIELDS],
])
const ROOT_KEY = ''
const KEY_SEPARATOR = '.'

function isTable(value: unknown): value is Table {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0
}

function warning(key: string, kind: ConfigWarningKind): ConfigWarning {
  return { key, kind }
}

function readSection(name: string, fields: Fields, raw: unknown): { readonly values: Table; readonly warnings: readonly ConfigWarning[] } {
  const table = isEmptyList(raw) ? {} : raw
  if (!isTable(table)) return { values: {}, warnings: [warning(name, ConfigWarningKind.Invalid)] }
  const values: Record<string, unknown> = {}
  const warnings: ConfigWarning[] = []
  for (const key of Object.keys(table)) {
    const schema = Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined
    const path = name + KEY_SEPARATOR + key
    const parsed = schema === undefined ? undefined : v.safeParse(schema, table[key])
    if (schema === undefined) warnings.push(warning(path, ConfigWarningKind.Unknown))
    else if (parsed?.success === true) values[key] = parsed.output
    else warnings.push(warning(path, ConfigWarningKind.Invalid))
  }
  return { values, warnings }
}

function defaultReading(warnings: readonly ConfigWarning[]): ConfigReading {
  return { config: DEFAULT_CONFIG, warnings }
}

function readSections(table: Table): ConfigReading {
  const warnings: ConfigWarning[] = []
  const sections: Record<string, Table> = {}
  for (const key of Object.keys(table)) {
    const fields = SECTIONS.get(key)
    if (fields === undefined) {
      warnings.push(warning(key, ConfigWarningKind.Unknown))
      continue
    }
    const section = readSection(key, fields, table[key])
    sections[key] = section.values
    warnings.push(...section.warnings)
  }
  const config: KitConfig = {
    theme: { ...DEFAULT_CONFIG.theme, ...sections['theme'] },
    input: { ...DEFAULT_CONFIG.input, ...sections['input'] },
    trace: { ...DEFAULT_CONFIG.trace, ...sections['trace'] },
  }
  return { config, warnings }
}

export function readConfig(raw: unknown): ConfigReading {
  const normalized = normalizePayload(raw)
  if (!normalized.ok) {
    const paths = Array.from(new Set(normalized.errors.map((error) => error.path)))
    return defaultReading(paths.map((path) => warning(path, ConfigWarningKind.Invalid)))
  }
  const root = isEmptyList(normalized.value) ? {} : normalized.value
  if (!isTable(root)) return defaultReading([warning(ROOT_KEY, ConfigWarningKind.Invalid)])
  return readSections(root)
}
