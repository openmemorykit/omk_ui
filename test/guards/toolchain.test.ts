import compat from 'eslint-plugin-compat'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { build, resolveConfig, type ResolvedConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import pageConfig from '../../tsconfig.page.json'
import pureConfig from '../../tsconfig.pure.json'
import testConfig from '../../tsconfig.test.json'
import testPageConfig from '../../tsconfig.test.page.json'

const TYPED_LINT_TIMEOUT = 30_000
const BUILD_TIMEOUT = 60_000
const NUMERIC_ERROR = 2
const FIXTURE_ERROR_COUNT = 2
const FIXTURE_LINES = Array.from({ length: FIXTURE_ERROR_COUNT }, (_, index) => index + 1)
const COMPAT_RULE = 'compat/compat'
const ERROR_SEVERITIES: readonly unknown[] = ['error', NUMERIC_ERROR]
const compatSettings = { lintAllEsApis: true }
const pageFiles = [
  'src/page/domain/scale.ts',
  'src/protocol/to-page.ts',
]
const fixture = 'test/guards/fixtures/newer-than-chromium-103.ts'
const shakeEntry = 'test/guards/fixtures/shake-entry.ts'
const STANDARD_MARK = '~standard'
const PREVIEW_MODE = 'preview'
const PRODUCTION_MODE = 'production'
const PAGE_LIB = ['ES2022', 'DOM']
const PURE_FOLDERS = ['src/page/application', 'src/page/i18n', 'preview/scenarios', 'preview/runtime']
const COMPONENT_FOLDERS = ['test/page/components/**', 'test/page/infrastructure/**', 'test/page/composition/**', 'test/preview/shell/**']

async function resolved(mode: string): Promise<ResolvedConfig> {
  return resolveConfig({ configFile: 'vite.config.ts', mode, logLevel: 'silent' }, 'build', mode)
}

function chunkCodes(output: unknown): string[] {
  const outputs = Array.isArray(output) ? output as { output: unknown[] }[] : [output as { output: unknown[] }]
  return outputs.flatMap((entry) => entry.output).flatMap((item) => ('code' in (item as object) ? [(item as { code: string }).code] : []))
}

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
    expect(lines).toEqual(FIXTURE_LINES)
  }, TYPED_LINT_TIMEOUT)

  it('keeps the pure code on ES2020', () => {
    expect(pureConfig.compilerOptions.lib).toEqual(['ES2020'])
  })

  it('tests the pure code on ES2022 and DOM', () => {
    expect(testConfig.compilerOptions.lib).toEqual(['ES2022', 'DOM'])
  })

  it('sets Vite to build for chrome103 under a relative base', async () => {
    const config = await resolved(PRODUCTION_MODE)
    expect(config.build.target).toBe('chrome103')
    expect(config.build.cssTarget).toEqual(config.build.target)
    expect(config.base).toBe('./')
    expect(config.build.assetsDir).toBe('assets')
    expect(config.build.emptyOutDir).toBe(true)
  })

  it('writes the page to omk_ui/web and reads fonts from .public', async () => {
    const config = await resolved(PRODUCTION_MODE)
    expect(config.build.outDir).toBe('omk_ui/web')
    expect(config.publicDir.endsWith('/.public')).toBe(true)
    expect(config.define).toMatchObject({ __OMK_PREVIEW__: false })
  })

  it('switches outDir and the preview constant in preview mode', async () => {
    const config = await resolved(PREVIEW_MODE)
    expect(config.build.outDir).toBe('.preview-dist')
    expect(config.define).toMatchObject({ __OMK_PREVIEW__: true })
  })

  it('turns the Vue feature flags off', async () => {
    const config = await resolved(PRODUCTION_MODE)
    expect(config.define).toMatchObject({
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    })
  })

  it('keeps valibot out of the empty page build', async () => {
    const output = await build({ configFile: 'vite.config.ts', logLevel: 'silent', build: { write: false } })
    const codes = chunkCodes(output)
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.some((code) => code.includes(STANDARD_MARK))).toBe(false)
  }, BUILD_TIMEOUT)

  it('drops a side-effect import of shared schemas from the build', async () => {
    const output = await build({
      configFile: 'vite.config.ts',
      logLevel: 'silent',
      build: { write: false, rolldownOptions: { input: shakeEntry } },
    })
    const codes = chunkCodes(output)
    expect(codes.some((code) => code.includes(STANDARD_MARK))).toBe(false)
  }, BUILD_TIMEOUT)

  it('keeps the page on ES2022 and DOM', () => {
    expect(pageConfig.compilerOptions.lib).toEqual(PAGE_LIB)
    expect(testPageConfig.compilerOptions.lib).toEqual(PAGE_LIB)
  })

  it('includes the pure page folders in the pure program', () => {
    expect(pureConfig.include).toEqual(expect.arrayContaining(PURE_FOLDERS))
  })

  it('excludes the folders that import components from the tsc test program', () => {
    expect(testConfig.exclude).toEqual(expect.arrayContaining(COMPONENT_FOLDERS))
  })
})
