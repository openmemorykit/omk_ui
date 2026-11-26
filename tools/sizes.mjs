import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const KILO = 1000
const GZIP_LEVEL = 9
export const BUDGETS = {
  jsBytes: 160 * KILO,
  jsGzipBytes: 60 * KILO,
  cssBytes: 30 * KILO,
  fontBytes: 150 * KILO,
  fontFamilies: 2,
}
const PREVIEW_MARKER = 'data-omk-preview'
const VALIBOT_MARKER = '~standard'
const ASSETS = 'assets/'
const FONTS = 'fonts/'
const FONT_FAMILY_SUFFIX = /-latin-.*$/

export function collectFiles(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    return entry.isDirectory() ? collectFiles(root, path) : [{ path, data: readFileSync(join(root, path)) }]
  })
}

const total = (files) => files.reduce((sum, file) => sum + file.data.length, 0)
const inFolder = (files, folder, extension) => files.filter((file) => file.path.startsWith(folder) && file.path.endsWith(extension))
const kilo = (bytes) => `${(bytes / KILO).toFixed(1)} Ko`

function measure(files) {
  const scripts = inFolder(files, ASSETS, '.js')
  const fonts = files.filter((file) => file.path.startsWith(FONTS))
  const families = new Set(fonts.filter((file) => file.path.endsWith('.woff2')).map((file) => file.path.slice(FONTS.length).replace(FONT_FAMILY_SUFFIX, '')))
  return {
    js: total(scripts),
    jsGzip: scripts.length === 0 ? 0 : gzipSync(Buffer.concat(scripts.map((file) => file.data)), { level: GZIP_LEVEL }).length,
    css: total(inFolder(files, ASSETS, '.css')),
    fonts: total(fonts),
    families: families.size,
  }
}

function leaks(files) {
  const preview = files.filter((file) => file.data.includes(PREVIEW_MARKER)).map((file) => `${file.path} contient ${PREVIEW_MARKER}`)
  const valibot = files.filter((file) => file.path.startsWith(ASSETS) && file.data.includes(VALIBOT_MARKER)).map((file) => `${file.path} contient ${VALIBOT_MARKER} (valibot dans le build livré)`)
  return [...preview, ...valibot]
}

export function checkSizes(files) {
  const size = measure(files)
  const rows = [
    ['JS minifié', size.js, BUDGETS.jsBytes],
    ['JS gzip', size.jsGzip, BUDGETS.jsGzipBytes],
    ['CSS minifié', size.css, BUDGETS.cssBytes],
    ['polices (licences comprises)', size.fonts, BUDGETS.fontBytes],
    ['familles de polices', size.families, BUDGETS.fontFamilies],
  ]
  const format = (value, limit) => (limit > KILO ? `${kilo(value)} / ${kilo(limit)}` : `${value} / ${limit}`)
  const report = rows.map(([name, value, limit]) => `${name} : ${format(value, limit)}`)
  const errors = rows.filter(([, value, limit]) => value > limit).map(([name, value, limit]) => `${name} : ${format(value, limit)}, budget dépassé`)
  return { report, errors: [...errors, ...leaks(files)] }
}

function main(dir) {
  let files = []
  try {
    files = collectFiles(dir)
  } catch {
    console.error(`Dossier illisible : ${dir}`)
    process.exit(1)
  }
  const { report, errors } = checkSizes(files)
  console.log(report.join('\n'))
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2] ?? '')
