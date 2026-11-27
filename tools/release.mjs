import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectFiles } from './sizes.mjs'
import { createZip } from './zip.mjs'

const FOLDER = 'omk_ui'
const OUTPUT = 'release'
const REQUIRED = [
  'fxmanifest.lua',
  'config.lua',
  'client/config_export.lua',
  'server/config_export.lua',
  'dist/client.js',
  'dist/server.js',
  'web/index.html',
]
const DELIVERED = [
  /^fxmanifest\.lua$/,
  /^config\.lua$/,
  /^(client|server)\/config_export\.lua$/,
  /^dist\/(client|server)\.js$/,
  /^web\/(index\.html|(assets|fonts)\/[^/]+)$/,
  /^locales\/[^/]+\.json$/,
  /^locales\/overrides\/([^/]+\.json|\.gitkeep)$/,
  /^branding\/[^/]+$/,
]
const ROOT_FILES = ['LICENSE', 'THIRD_PARTY.md']

export function archiveName(version) {
  return `${FOLDER}-${version}.zip`
}

export function buildArchive(root) {
  const delivered = collectFiles(join(root, FOLDER)).filter((file) => DELIVERED.some((pattern) => pattern.test(file.path)))
  for (const required of REQUIRED) {
    if (!delivered.some((file) => file.path === required)) throw new Error(`${FOLDER}/${required} absent : lance npm run build`)
  }
  const copied = ROOT_FILES.map((name) => ({ path: name, data: readFileSync(join(root, name)) }))
  const entries = [...delivered, ...copied].map((file) => ({ name: `${FOLDER}/${file.path}`, data: file.data }))
  return createZip(entries.sort((left, right) => (left.name < right.name ? -1 : 1)))
}

function main() {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version
  try {
    const archive = buildArchive('.')
    mkdirSync(OUTPUT, { recursive: true })
    writeFileSync(join(OUTPUT, archiveName(version)), archive)
    console.log(`${OUTPUT}/${archiveName(version)} : ${archive.length} octets`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
