import { ESLint, type Linter } from 'eslint'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import clientConfig from '../../tsconfig.client.json'
import pureConfig from '../../tsconfig.pure.json'
import serverConfig from '../../tsconfig.server.json'
import testClientConfig from '../../tsconfig.test.client.json'
import testConfig from '../../tsconfig.test.json'
import testServerConfig from '../../tsconfig.test.server.json'

const LINT_TIMEOUT = 180_000
const TSC_TIMEOUT = 60_000
const FIXTURES = 'test/fixtures/lint'
const IMPORTS = 'no-restricted-imports'
const APPLICATION_MESSAGE = "L'application n'importe ni infrastructure ni composants."
const MISSING_NATIVE = "Cannot find name 'PlayerPedId'"
const COMPILER = 'node_modules/typescript/bin/tsc'
const COMPILED_CLIENT_FOLDERS = ['src/client', 'src/protocol', 'src/shared', 'preview/scenarios', 'preview/runtime']

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ ignore: false })
})

async function lint(path: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintFiles([`${FIXTURES}/${path}`])
  const messages: Linter.LintMessage[] = result?.messages ?? []
  expect(messages.filter((message) => message.fatal === true)).toEqual([])
  return messages
}

async function ruleIds(path: string): Promise<(string | null)[]> {
  return (await lint(path)).map((message) => message.ruleId)
}

function compile(fixture: string): { status: number | null; output: string } {
  const config = join(mkdtempSync(join(tmpdir(), 'omk-guard-')), 'tsconfig.json')
  writeFileSync(config, JSON.stringify({ extends: resolve('tsconfig.pure.json'), include: [resolve(fixture)] }))
  const run = spawnSync('node', [COMPILER, '--noEmit', '-p', config], { encoding: 'utf8' })
  return { status: run.status, output: run.stdout }
}

describe('layers of the client and server application', () => {
  it.each(['imports-citizenfx.ts', 'imports-infrastructure.ts'])('eslint refuses %s with the application rule', async (name) => {
    for (const side of ['client', 'server']) {
      const refusals = (await lint(`${side}-application/${name}`)).filter((message) => message.ruleId === IMPORTS)
      expect(refusals).toHaveLength(1)
      expect(refusals[0]?.message).toContain(APPLICATION_MESSAGE)
    }
  }, LINT_TIMEOUT)

  it('tsc refuses a native called in the application, in the pure program', () => {
    const run = compile('test/guards/fixtures/native-in-application.ts')
    expect(run.status).not.toBe(0)
    expect(run.output).toContain(MISSING_NATIVE)
  }, TSC_TIMEOUT)

  it('tsc accepts the same fixture without the native call', () => {
    expect(compile('test/guards/fixtures/no-native-in-application.ts').status).toBe(0)
  }, TSC_TIMEOUT)

  it('puts both applications in the pure program, without any @citizenfx type', () => {
    expect(pureConfig.include).toEqual(expect.arrayContaining(['src/client/application', 'src/server/application']))
    expect(pureConfig.compilerOptions.types).toEqual([])
  })
})

describe('clocks and browser-only apis', () => {
  it.each(['client-application/date-now.ts', 'server-application/date-now.ts'])('eslint refuses Date.now in %s', async (fixture) => {
    expect(await ruleIds(fixture)).toEqual(['no-restricted-properties'])
  }, LINT_TIMEOUT)

  it('eslint refuses performance.now in the compiled client code', async () => {
    expect(await ruleIds('client-compiled/performance-now.ts')).toEqual(['no-restricted-properties'])
  }, LINT_TIMEOUT)

  it('eslint refuses performance.now in the client application, which also refuses Date.now', async () => {
    expect(await ruleIds('client-application/performance-now.ts')).toEqual(['no-restricted-properties'])
  }, LINT_TIMEOUT)

  it.each(['client-compiled/structured-clone.ts', 'client-compiled/queue-microtask.ts'])('eslint refuses the browser global in %s', async (fixture) => {
    expect(await ruleIds(fixture)).toEqual(['no-restricted-globals'])
  }, LINT_TIMEOUT)

  it.each(['client-compiled/clean.ts', 'client-application/clean.ts', 'server-application/performance-now-allowed.ts'])('eslint accepts %s', async (fixture) => {
    expect(await ruleIds(fixture)).toEqual([])
  }, LINT_TIMEOUT)
})

describe('programs per side', () => {
  it('compiles the client sides against the client natives only, on ES2020', () => {
    expect(clientConfig.compilerOptions.types).toEqual(['@citizenfx/client'])
    expect(clientConfig.compilerOptions.lib).toEqual(['ES2020'])
    expect(clientConfig.include).toEqual(expect.arrayContaining(COMPILED_CLIENT_FOLDERS))
  })

  it('compiles the server against the server natives only, on ES2020', () => {
    expect(serverConfig.compilerOptions.types).toEqual(['@citizenfx/server'])
    expect(serverConfig.compilerOptions.lib).toEqual(['ES2020'])
    expect(serverConfig.include).toEqual(expect.arrayContaining(['src/server', 'src/protocol', 'src/shared']))
  })

  it('never puts both natives in one program', () => {
    expect(JSON.stringify(serverConfig)).not.toContain('@citizenfx/client')
    expect(JSON.stringify(clientConfig)).not.toContain('@citizenfx/server')
    expect(JSON.stringify(testClientConfig)).not.toContain('@citizenfx/server')
    expect(JSON.stringify(testServerConfig)).not.toContain('@citizenfx/client')
  })

  it('tests the adapters of each side in its own program', () => {
    expect(testClientConfig.compilerOptions.types).toContain('@citizenfx/client')
    expect(testServerConfig.compilerOptions.types).toContain('@citizenfx/server')
    expect(testConfig.extends).toBe('./tsconfig.pure.json')
    expect(testConfig.exclude).toEqual(expect.arrayContaining(['test/client/infrastructure/**', 'test/client/composition/**', 'test/server/infrastructure/**', 'test/server/composition/**']))
  })
})
