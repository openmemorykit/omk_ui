import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'

const MANIFEST_URL = new URL('../src/page/theme/fonts.json', import.meta.url)
const SOURCE_ROOT = 'node_modules'
const TARGET_DIR = '.public/fonts'
const LICENSE_FILE = 'LICENSE'
const FILES_DIR = 'files'

export function licenseName(packageName) {
  return `${basename(packageName)}-OFL.txt`
}

function wantedFiles(family, sourceRoot) {
  const packageDir = join(sourceRoot, family.package)
  const fonts = Object.values(family.weights).map((name) => [join(packageDir, FILES_DIR, name), name])
  return [[join(packageDir, LICENSE_FILE), licenseName(family.package)], ...fonts]
}

export function copyFonts(manifest, sourceRoot, targetDir) {
  rmSync(targetDir, { recursive: true, force: true })
  mkdirSync(targetDir, { recursive: true })
  const copied = []
  const missing = []
  for (const family of Object.values(manifest)) {
    for (const [from, name] of wantedFiles(family, sourceRoot)) {
      if (existsSync(from)) {
        copyFileSync(from, join(targetDir, name))
        copied.push(name)
      } else {
        missing.push(from)
      }
    }
  }
  return { copied, missing }
}

if (import.meta.main) {
  const manifest = JSON.parse(readFileSync(MANIFEST_URL, 'utf8'))
  const { copied, missing } = copyFonts(manifest, SOURCE_ROOT, TARGET_DIR)
  if (missing.length > 0) {
    console.error(`Polices absentes : ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log(`${copied.length} fichiers copiés dans ${TARGET_DIR}`)
}
