import { isRecord } from '@openmemorykit/core/shared'
import { LocaleWarningKind, type LocaleWarning } from './locale-warning'

export type LocaleFileReader = (path: string) => string | null

export const LocaleFileStatus = { Absent: 'absent', Unusable: 'unusable', Read: 'read' } as const

export const LOCALE_FILE_MAX_CHARS = 262_144

export type LocaleFile =
  | { readonly status: typeof LocaleFileStatus.Absent; readonly warnings: readonly LocaleWarning[] }
  | { readonly status: typeof LocaleFileStatus.Unusable; readonly warnings: readonly LocaleWarning[] }
  | { readonly status: typeof LocaleFileStatus.Read; readonly entries: ReadonlyMap<string, unknown>; readonly warnings: readonly LocaleWarning[] }

function parse(content: string): unknown {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

function unusable(path: string, kind: LocaleWarningKind): LocaleFile {
  return { status: LocaleFileStatus.Unusable, warnings: [{ kind, file: path }] }
}

export function readLocaleFile(readFile: LocaleFileReader, path: string): LocaleFile {
  const content = readFile(path)
  if (content === null) return { status: LocaleFileStatus.Absent, warnings: [{ kind: LocaleWarningKind.FileUnreadable, file: path }] }
  if (content.length > LOCALE_FILE_MAX_CHARS) return unusable(path, LocaleWarningKind.FileTooLarge)
  const parsed = parse(content)
  if (!isRecord(parsed)) return unusable(path, LocaleWarningKind.FileMalformed)
  return { status: LocaleFileStatus.Read, entries: new Map(Object.entries(parsed)), warnings: [] }
}
