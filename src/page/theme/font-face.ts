import type { ValueOf } from '@openmemorykit/core/shared'
import { FontFamily } from '../../shared/config/theme-defaults'
import fonts from './fonts.json'

const FONTS_DIRECTORY = 'fonts/'
const HEX_RADIX = 16
const ESCAPE_DIGITS = 2
const UNSAFE_URL_CHARACTERS = /['"\\()\s]/g

type FontFamilyName = ValueOf<typeof FontFamily>

function escapeCharacter(character: string): string {
  return `%${character.charCodeAt(0).toString(HEX_RADIX).toUpperCase().padStart(ESCAPE_DIGITS, '0')}`
}

function safeBase(baseUrl: string): string {
  return baseUrl.replace(UNSAFE_URL_CHARACTERS, escapeCharacter)
}

function rule(cssName: string, weight: string, file: string, baseUrl: string): string {
  return [
    '@font-face {',
    `  font-family: '${cssName}';`,
    '  font-style: normal;',
    `  font-weight: ${weight};`,
    '  font-display: block;',
    `  src: url('${safeBase(baseUrl)}${FONTS_DIRECTORY}${file}') format('woff2');`,
    '}',
  ].join('\n')
}

export function fontFaceCss(family: FontFamilyName, baseUrl: string): string {
  const { cssName, weights } = fonts[family]
  return Object.entries(weights)
    .map(([weight, file]) => rule(cssName, weight, file, baseUrl))
    .join('\n')
}
