import compat from 'eslint-plugin-compat'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import pureConfig from '../../../../tsconfig.pure.json'
import testConfig from '../../../../tsconfig.test.json'

const TYPED_LINT_TIMEOUT = 30_000
const NUMERIC_ERROR = 2
const SECOND_LINE = 2
const COMPAT_RULE = 'compat/compat'
const ERROR_SEVERITIES: readonly unknown[] = ['error', NUMERIC_ERROR]
const compatSettings = { lintAllEsApis: true }
const pageFiles = [
  'resources/ui/src/page/domain/scale.ts',
  'packages/ui/src/contract/items.ts',
  'resources/ui/src/protocol/to-page.ts',
]
const fixture = 'resources/ui/test/guards/fixtures/newer-than-chromium-103.ts'

async function configFor(file: string): Promise<{ rules?: Record<string, unknown> }> {
  const config: unknown = await new ESLint().calculateConfigForFile(file)
  return config as { rules?: Record<string, unknown> }
}

function severityOf(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry
}

describe('toolchain guards', () => {
  it.each(pageFiles)('enables compat as an error on %s', async (file) => {
    const config = await configFor(file)
    expect(ERROR_SEVERITIES).toContain(severityOf(config.rules?.[COMPAT_RULE]))
  }, TYPED_LINT_TIMEOUT)

  it.each(pageFiles)('forbids the regex v flag on %s', async (file) => {
    const config = await configFor(file)
    const restricted = JSON.stringify(config.rules?.['no-restricted-syntax'])
    expect(restricted).toContain('Literal[regex.flags=/v/]')
  }, TYPED_LINT_TIMEOUT)

  it('reports one compat error per line of the post-Chromium-103 fixture', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          ...compat.configs['flat/recommended'],
          files: ['**/*.ts'],
          languageOptions: { parser: tseslint.parser },
          settings: compatSettings,
        },
      ],
    })
    const [result] = await eslint.lintFiles([fixture])
    const lines = result?.messages.filter((message) => message.ruleId === COMPAT_RULE).map((message) => message.line)
    expect(lines).toEqual([1, SECOND_LINE])
  }, TYPED_LINT_TIMEOUT)

  it('keeps the pure code on ES2020', () => {
    expect(pureConfig.compilerOptions.lib).toEqual(['ES2020'])
  })

  it('tests the pure code on ES2022 and DOM', () => {
    expect(testConfig.compilerOptions.lib).toEqual(['ES2022', 'DOM'])
  })
})
