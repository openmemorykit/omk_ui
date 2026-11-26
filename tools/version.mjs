import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MANIFEST = 'omk_ui/fxmanifest.lua'
const PACKAGE = 'package.json'
const WRITE_FLAG = '--write'
const MANIFEST_VERSION = /^version\s+'([^']+)'\s*$/m
const VERSION_LITERAL = /^version\s+'[^']+'/m

export function manifestVersion(manifest) {
  return MANIFEST_VERSION.exec(manifest)?.[1]
}

export function checkVersions(manifest, packageJson) {
  const declared = manifestVersion(manifest)
  const expected = JSON.parse(packageJson).version
  return declared === expected ? undefined : `${MANIFEST} : version ${String(declared)}, ${PACKAGE} : version ${String(expected)}`
}

export function writeManifestVersion(manifest, version) {
  if (manifestVersion(manifest) === undefined) return undefined
  return manifest.replace(VERSION_LITERAL, () => `version '${version}'`)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(write) {
  const packageJson = readFileSync(PACKAGE, 'utf8')
  if (write) {
    const written = writeManifestVersion(readFileSync(MANIFEST, 'utf8'), JSON.parse(packageJson).version)
    if (written === undefined) fail(`${MANIFEST} : aucune ligne version`)
    writeFileSync(MANIFEST, written)
  }
  const error = checkVersions(readFileSync(MANIFEST, 'utf8'), packageJson)
  if (error !== undefined) fail(error)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run(process.argv.includes(WRITE_FLAG))
