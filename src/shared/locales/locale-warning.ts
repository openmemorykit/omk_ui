import type { ValueOf } from '@openmemorykit/core/shared'

export const LocaleWarningKind = {
  FileUnreadable: 'fileUnreadable',
  FileMalformed: 'fileMalformed',
  FileTooLarge: 'fileTooLarge',
  LanguageUnavailable: 'languageUnavailable',
  UnknownKey: 'unknownKey',
  ParameterMismatch: 'parameterMismatch',
  NotText: 'notText',
  Truncated: 'truncated',
} as const
export type LocaleWarningKind = ValueOf<typeof LocaleWarningKind>

export interface LocaleWarning {
  readonly kind: LocaleWarningKind
  readonly file: string
  readonly key?: string
}

export const LOCALE_WARNINGS_MAX = 20
