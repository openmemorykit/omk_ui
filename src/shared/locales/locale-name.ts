export const BASE_LANGUAGE = 'en'

const LOCALE_NAME_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/

export function isLocaleName(name: string): boolean {
  return LOCALE_NAME_PATTERN.test(name)
}

export const LocalePath = {
  language: (language: string): string => `locales/${language}.json`,
  overrides: (language: string): string => `locales/overrides/${language}.json`,
} as const
