import { normalizePayload } from '@openmemorykit/ui/validation'
import { MAX_REPORTED_ERRORS, type ContractError } from '@openmemorykit/ui/contract'
import * as v from 'valibot'
import { hasOwnKey, isRecord, type ValueOf } from '@openmemorykit/core/shared'
import { DEFAULT_CONFIG, INPUT_FIELDS, THEME_FIELDS, TRACE_FIELDS, type KitConfig } from './config-schema'

export const ConfigWarningKind = { Invalid: 'invalid', Unknown: 'unknown', Truncated: 'truncated' } as const
export type ConfigWarningKind = ValueOf<typeof ConfigWarningKind>

export interface ConfigWarning {
  readonly key: string
  readonly kind: ConfigWarningKind
  readonly detail?: string
}
export interface ConfigReading {
  readonly config: KitConfig
  readonly warnings: readonly ConfigWarning[]
}

type Fields = Readonly<Record<string, v.GenericSchema>>
type Table = Readonly<Record<string, unknown>>
type Section = { readonly values: Table; readonly warnings: readonly ConfigWarning[] }

const SECTIONS = new Map<string, Fields>([
  ['theme', THEME_FIELDS],
  ['input', INPUT_FIELDS],
  ['trace', TRACE_FIELDS],
])
const ROOT_KEY = ''
const KEY_SEPARATOR = '.'

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0
}

function warning(key: string, kind: ConfigWarningKind, detail?: string): ConfigWarning {
  return detail === undefined ? { key, kind } : { key, kind, detail }
}

function readSection(name: string, fields: Fields, raw: unknown): Section {
  const table = isEmptyList(raw) ? {} : raw
  if (!isRecord(table)) return { values: {}, warnings: [warning(name, ConfigWarningKind.Invalid)] }
  const values: Record<string, unknown> = {}
  const warnings: ConfigWarning[] = []
  for (const key of Object.keys(table)) {
    if (warnings.length > MAX_REPORTED_ERRORS) break
    const path = name + KEY_SEPARATOR + key
    const schema = hasOwnKey(fields, key) ? fields[key] : undefined
    if (schema === undefined) {
      warnings.push(warning(path, ConfigWarningKind.Unknown))
      continue
    }
    const parsed = v.safeParse(schema, table[key])
    if (parsed.success) values[key] = parsed.output
    else warnings.push(warning(path, ConfigWarningKind.Invalid))
  }
  return { values, warnings }
}

function nullWarnings(raw: unknown): readonly ConfigWarning[] {
  const warnings: ConfigWarning[] = []
  try {
    if (!isRecord(raw)) return warnings
    for (const key of Object.keys(raw)) {
      if (warnings.length > MAX_REPORTED_ERRORS) break
      const fields = SECTIONS.get(key)
      if (raw[key] === null) warnings.push(warning(key, fields === undefined ? ConfigWarningKind.Unknown : ConfigWarningKind.Invalid))
      else if (fields !== undefined) warnings.push(...nullSectionWarnings(key, fields, raw[key]))
    }
  } catch {
    return warnings
  }
  return warnings
}

function nullSectionWarnings(name: string, fields: Fields, section: unknown): readonly ConfigWarning[] {
  if (!isRecord(section)) return []
  return Object.keys(section)
    .filter((key) => section[key] === null)
    .flatMap((key) => {
      const schema = hasOwnKey(fields, key) ? fields[key] : undefined
      if (schema === undefined) return [warning(name + KEY_SEPARATOR + key, ConfigWarningKind.Unknown)]
      return v.safeParse(schema, null).success ? [] : [warning(name + KEY_SEPARATOR + key, ConfigWarningKind.Invalid)]
    })
}

function capWarnings(warnings: readonly ConfigWarning[]): readonly ConfigWarning[] {
  if (warnings.length <= MAX_REPORTED_ERRORS) return warnings
  return [...warnings.slice(0, MAX_REPORTED_ERRORS), warning(ROOT_KEY, ConfigWarningKind.Truncated)]
}

function defaultReading(warnings: readonly ConfigWarning[]): ConfigReading {
  return { config: DEFAULT_CONFIG, warnings }
}

function refusalWarnings(errors: readonly ContractError[]): readonly ConfigWarning[] {
  const seen = new Set<string>()
  const warnings: ConfigWarning[] = []
  for (const error of errors) {
    if (seen.has(error.path)) continue
    seen.add(error.path)
    warnings.push(warning(error.path, ConfigWarningKind.Invalid, error.detail))
  }
  return capWarnings(warnings)
}

function readSections(table: Table, raw: unknown): ConfigReading {
  const warnings: ConfigWarning[] = []
  const sections: Record<string, Table> = {}
  for (const key of Object.keys(table)) {
    if (warnings.length > MAX_REPORTED_ERRORS) break
    const fields = SECTIONS.get(key)
    if (fields === undefined) {
      warnings.push(warning(key, ConfigWarningKind.Unknown))
      continue
    }
    const section = readSection(key, fields, table[key])
    sections[key] = section.values
    warnings.push(...section.warnings)
  }
  warnings.push(...nullWarnings(raw))
  const config: KitConfig = {
    theme: { ...DEFAULT_CONFIG.theme, ...sections['theme'] },
    input: { ...DEFAULT_CONFIG.input, ...sections['input'] },
    trace: { ...DEFAULT_CONFIG.trace, ...sections['trace'] },
  }
  return { config, warnings: capWarnings(warnings) }
}

export function readConfig(raw: unknown): ConfigReading {
  const normalized = normalizePayload(raw)
  if (!normalized.ok) return defaultReading(refusalWarnings(normalized.errors))
  const root = isEmptyList(normalized.value) ? {} : normalized.value
  if (!isRecord(root)) return defaultReading([warning(ROOT_KEY, ConfigWarningKind.Invalid)])
  return readSections(root, raw)
}
