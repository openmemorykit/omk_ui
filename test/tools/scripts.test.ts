import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildScripts, readVersion, scriptOptions } from '../../tools/scripts.mjs'

const BUILD_TIMEOUT = 60_000
const RESOURCE_NAME = 'omk_ui'
const WRONG_NAME = 'omk_ui_copy'
const NATIVE_MISSING = /is not defined/

function temporaryFolder(): string {
  return mkdtempSync(join(tmpdir(), 'omk-scripts-'))
}

function project(clientSource: string, serverSource: string): string {
  const root = temporaryFolder()
  mkdirSync(join(root, 'src', 'client'), { recursive: true })
  mkdirSync(join(root, 'src', 'server'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"version":"1.2.3"}')
  writeFileSync(join(root, 'src', 'client', 'main.ts'), clientSource)
  writeFileSync(join(root, 'src', 'server', 'main.ts'), serverSource)
  return root
}

async function buildRepository(): Promise<{ client: string; server: string }> {
  const distFolder = temporaryFolder()
  await buildScripts('.', distFolder)
  return { client: readFileSync(join(distFolder, 'client.js'), 'utf8'), server: readFileSync(join(distFolder, 'server.js'), 'utf8') }
}

interface SandboxOutput {
  readonly errors: string[]
  readonly lines: string[]
}

function runWithResourceName(code: string, resourceName: string): SandboxOutput {
  const errors: string[] = []
  const lines: string[] = []
  const console = { error: (line: string) => errors.push(line), log: (line: string) => lines.push(line) }
  runInNewContext(code, { GetCurrentResourceName: () => resourceName, GetGameTimer: () => 0, console })
  return { errors, lines }
}

describe('tools/scripts options', () => {
  const [client, server] = scriptOptions('/repo', '1.2.3')

  it('builds the client as a minified iife for the neutral platform', () => {
    expect(client).toEqual({
      entryPoints: ['/repo/src/client/main.ts'],
      outfile: '/repo/omk_ui/dist/client.js',
      bundle: true,
      minify: true,
      format: 'iife',
      platform: 'neutral',
      target: 'es2020',
      define: { __OMK_VERSION__: '"1.2.3"', __OMK_PREVIEW__: 'false' },
      logLevel: 'silent',
    })
  })

  it('builds the server as minified commonjs for node', () => {
    expect(server).toEqual({
      entryPoints: ['/repo/src/server/main.ts'],
      outfile: '/repo/omk_ui/dist/server.js',
      bundle: true,
      minify: true,
      format: 'cjs',
      platform: 'node',
      target: 'es2020',
      define: { __OMK_VERSION__: '"1.2.3"', __OMK_PREVIEW__: 'false' },
      logLevel: 'silent',
    })
  })

  it('reads the version from package.json, the only place it is written', () => {
    expect(readVersion(project('', ''))).toBe('1.2.3')
    expect(readVersion('.')).toBe((JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version)
  })
})

describe('tools/scripts build', () => {
  it('keeps the client free of module syntax and commonjs wrappers', async () => {
    const { client } = await buildRepository()
    expect(client).not.toMatch(/\brequire\(/)
    expect(client).not.toMatch(/(^|[;}\n])import[\s{*"']/)
    expect(client).not.toContain('__commonJS')
  }, BUILD_TIMEOUT)

  it('keeps the server a commonjs script that exports nothing', async () => {
    const { server } = await buildRepository()
    expect(server).not.toContain('module.exports')
    expect(server).not.toMatch(/(^|[;}\n])(import|export)[\s{*"']/)
  }, BUILD_TIMEOUT)

  it('leaves no @citizenfx package in either script', async () => {
    const { client, server } = await buildRepository()
    expect(client).not.toContain('@citizenfx')
    expect(server).not.toContain('@citizenfx')
  }, BUILD_TIMEOUT)

  it.each(['client', 'server'] as const)('refuses to start the %s script under another folder name with one line, touching no other native', async (side) => {
    const built = await buildRepository()
    const { errors } = runWithResourceName(built[side], WRONG_NAME)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(`${RESOURCE_NAME} refuses to start`)
  }, BUILD_TIMEOUT)

  it.each(['client', 'server'] as const)('goes past the name check of the %s script under omk_ui and reports the first native the sandbox lacks without throwing', async (side) => {
    const built = await buildRepository()
    const { errors, lines } = runWithResourceName(built[side], RESOURCE_NAME)
    expect(errors).toStrictEqual([])
    expect(lines.some((line) => NATIVE_MISSING.test(line))).toBe(true)
  }, BUILD_TIMEOUT)

  it('fails the build on an esbuild warning', async () => {
    const root = project('', "export const value = 1\nmodule.exports = value\n")
    await expect(buildScripts(root)).rejects.toThrow(/commonjs-variable-in-esm|module/)
  }, BUILD_TIMEOUT)

  it('writes both scripts under omk_ui/dist', async () => {
    const root = project('', '')
    await buildScripts(root)
    expect(existsSync(join(root, 'omk_ui', 'dist', 'client.js'))).toBe(true)
    expect(existsSync(join(root, 'omk_ui', 'dist', 'server.js'))).toBe(true)
  }, BUILD_TIMEOUT)

  it('exits with status 1 and the warning from the command line', () => {
    const root = project('', "export const value = 1\nmodule.exports = value\n")
    const run = spawnSync('node', [join(process.cwd(), 'tools/scripts.mjs')], { cwd: root, encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('module')
  }, BUILD_TIMEOUT)
})
