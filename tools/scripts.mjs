import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, formatMessages } from 'esbuild'

const DIST_FOLDER = 'omk_ui/dist'
const TARGET = 'es2020'
const VERSION_DEFINE = '__OMK_VERSION__'
const PREVIEW_DEFINE = '__OMK_PREVIEW__'

const SIDES = [
  { entry: 'src/client/main.ts', output: 'client.js', format: 'iife', platform: 'neutral' },
  { entry: 'src/server/main.ts', output: 'server.js', format: 'iife', platform: 'node' },
]

export function readVersion(root) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
}

export function scriptOptions(root, version, distFolder = join(root, DIST_FOLDER)) {
  return SIDES.map(({ entry, output, format, platform }) => ({
    entryPoints: [join(root, entry)],
    outfile: join(distFolder, output),
    bundle: true,
    minify: true,
    format,
    platform,
    target: TARGET,
    define: { [VERSION_DEFINE]: JSON.stringify(version), [PREVIEW_DEFINE]: 'false' },
    logLevel: 'silent',
  }))
}

async function buildOne(options) {
  const { warnings } = await build(options)
  if (warnings.length > 0) throw new Error((await formatMessages(warnings, { kind: 'warning' })).join('\n'))
}

export async function buildScripts(root = '.', distFolder = join(root, DIST_FOLDER)) {
  for (const options of scriptOptions(root, readVersion(root), distFolder)) await buildOne(options)
}

async function main() {
  try {
    await buildScripts()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
