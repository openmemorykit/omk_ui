import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BOUNDARY = String.raw`(?<![\w-])`
const MATH_FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2']
const LONE_PROPERTIES = ['translate', 'rotate', 'scale']
const WRAPPING_AT_RULES = /^@(?:media|supports|layer)\b/
const KEYFRAMES_AT_RULE = /^@(?:-\w+-)?keyframes\b/

const RULES = [
  [':has(', /:has\(/],
  ['color-mix(', /color-mix\(/],
  ['@container', /@container\b/],
  ['backdrop-filter', /backdrop-filter/],
  ['blur(', /blur\(/],
  ['unité dvh/svh/lvh', /\d(?:d|s|l)vh\b/],
  ['text-wrap: balance', /text-wrap\s*:\s*balance/],
  ...LONE_PROPERTIES.map((name) => [`propriété ${name} seule`, new RegExp(String.raw`(?:^|[{;\s])${name}\s*:`)]),
  ...MATH_FUNCTIONS.map((name) => [`${name}(`, new RegExp(`${BOUNDARY}${name}\\(`)]),
  ['linear(', new RegExp(`${BOUNDARY}linear\\(`)],
  ['oklch(', /oklch\(/],
  ['oklab(', /oklab\(/],
  ['@starting-style', /@starting-style/],
  [':modal', /:modal\b/],
  ['linear-gradient(', /linear-gradient\(/],
  ['radial-gradient(', /radial-gradient\(/],
  ['conic-gradient(', /conic-gradient\(/],
]

function skipComment(css, start) {
  const end = css.indexOf('*/', start + 2)
  return end === -1 ? css.length : end + 2
}

function skipString(css, start) {
  const quote = css[start]
  let at = start + 1
  while (at < css.length && css[at] !== quote) at += css[at] === '\\' ? 2 : 1
  return at + 1
}

function skipUrl(css, start) {
  let at = start + 'url('.length
  while (at < css.length && css[at] !== ')') {
    at = css[at] === '"' || css[at] === "'" ? skipString(css, at) : at + 1
  }
  return at + 1
}

export function stripCss(css) {
  let out = ''
  let at = 0
  while (at < css.length) {
    const char = css[at]
    if (char === '/' && css[at + 1] === '*') {
      at = skipComment(css, at)
    } else if (char === '"' || char === "'") {
      out += '""'
      at = skipString(css, at)
    } else if (css.slice(at, at + 'url('.length).toLowerCase() === 'url(') {
      out += 'url()'
      at = skipUrl(css, at)
    } else {
      out += char
      at += 1
    }
  }
  return out
}

function blockKind(prelude, parent) {
  if (parent === 'keyframes') return 'frame'
  if (KEYFRAMES_AT_RULE.test(prelude)) return 'keyframes'
  return WRAPPING_AT_RULES.test(prelude) ? 'wrapper' : 'rule'
}

function hasNesting(css) {
  const stack = []
  let prelude = ''
  for (const char of css) {
    if (char === '{') {
      const parent = stack.at(-1)
      const kind = blockKind(prelude.trim().toLowerCase(), parent)
      if (parent === 'rule' && (kind === 'rule' || kind === 'wrapper')) return true
      stack.push(kind)
      prelude = ''
    } else if (char === '}') {
      stack.pop()
      prelude = ''
    } else if (char === ';') {
      prelude = ''
    } else {
      prelude += char
    }
  }
  return false
}

export function scanCss(css) {
  const stripped = stripCss(css)
  const findings = RULES.filter(([, pattern]) => pattern.test(stripped)).map(([name]) => name)
  if (hasNesting(stripped)) findings.push('sélecteur imbriqué natif')
  return findings
}

function readCssNames(dir) {
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.css'))
  } catch {
    console.error(`Dossier illisible : ${dir}`)
    return process.exit(1)
  }
}

function main(dir) {
  const names = readCssNames(dir)
  let failed = false
  for (const name of names) {
    for (const finding of scanCss(readFileSync(join(dir, name), 'utf8'))) {
      console.error(`${name} : ${finding}`)
      failed = true
    }
  }
  if (failed) process.exit(1)
  console.log(`${names.length} fichier(s) CSS sans motif interdit`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2] ?? '')
