import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectDeliveredEntries, FOLDER } from './release.mjs'

const USAGE = 'usage : node tools/export-build.mjs <destination>'

function isInside(parent, child) {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !path.startsWith('/'))
}

// Copies the delivered folder (the one the release archive holds) to <destination>/omk_ui.
// Nothing is written when the build is incomplete or the destination overlaps the source.
export function exportBuild(root, destination) {
  const source = resolve(root, FOLDER)
  const target = resolve(destination)
  if (isInside(target, resolve(root)) || isInside(source, target)) {
    throw new Error(`destination ${target} : elle ne peut pas contenir ni se trouver dans le projet livré`)
  }
  const entries = collectDeliveredEntries(root)
  const exported = join(target, FOLDER)
  rmSync(exported, { recursive: true, force: true })
  for (const entry of entries) {
    const path = join(exported, entry.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, entry.data)
  }
  return entries.map((entry) => entry.path)
}

function main() {
  const destination = process.argv[2]
  if (destination === undefined || process.argv.length > 3) {
    console.error(`destination absente. ${USAGE}`)
    process.exit(1)
  }
  try {
    const files = exportBuild('.', destination)
    console.log(`${files.length} fichiers exportés dans ${join(resolve(destination), FOLDER)}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
