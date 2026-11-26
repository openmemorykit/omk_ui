import { readFileSync } from 'node:fs'

const MANIFEST = 'omk_ui/fxmanifest.lua'
const PACKAGE = 'package.json'
const MANIFEST_VERSION = /^version\s+'([^']+)'\s*$/m

export function manifestVersion(manifest) {
  return MANIFEST_VERSION.exec(manifest)?.[1]
}

export function checkVersions(manifest, packageJson) {
  const declared = manifestVersion(manifest)
  const expected = JSON.parse(packageJson).version
  return declared === expected ? undefined : `${MANIFEST} : version ${String(declared)}, ${PACKAGE} : version ${String(expected)}`
}

if (import.meta.main) {
  const error = checkVersions(readFileSync(MANIFEST, 'utf8'), readFileSync(PACKAGE, 'utf8'))
  if (error !== undefined) {
    console.error(error)
    process.exit(1)
  }
}
