import { ESLint, type Linter } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const LINT_TIMEOUT = 180_000
const NUMERIC_ERROR = 2
const FIXTURES = 'test/fixtures/lint'
const SYNTAX = 'no-restricted-syntax'
const VUE_SYNTAX = 'vue/no-restricted-syntax'
const IMPORTS = 'no-restricted-imports'
const COMPAT = 'compat/compat'
const MAGIC = '@typescript-eslint/no-magic-numbers'
const CITIZENFX_MESSAGE = /natives/
const NAMED_IMPORT_COUNT = 3
const FLOATING_LINE = 5
const TEMPLATE_LINE = 6

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ ignore: false })
})

async function lintFixture(name: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintFiles([`${FIXTURES}/${name}`])
  const messages = result?.messages ?? []
  expect(messages.filter((message) => message.fatal === true)).toEqual([])
  return messages
}

async function lintAt(path: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintFiles([path])
  return result?.messages ?? []
}

function forRule(messages: readonly Linter.LintMessage[], ruleId: string): Linter.LintMessage[] {
  return messages.filter((message) => message.ruleId === ruleId)
}

async function configAt(path: string): Promise<Linter.Config | undefined> {
  return (await eslint.calculateConfigForFile(path)) as Linter.Config | undefined
}

function severityOf(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry
}

const ruleCases: readonly (readonly [string, string, number])[] = [
  ['script-string-comparison.vue', SYNTAX, 1],
  ['script-case-literal.vue', SYNTAX, 1],
  ['script-regex-v-flag.vue', SYNTAX, 1],
  ['regex-v-flag.ts', SYNTAX, 1],
  ['script-denied-identifier.vue', 'id-denylist', 1],
  ['script-short-identifier.vue', 'id-length', 1],
  ['script-magic-number.vue', MAGIC, 1],
  ['script-let-never-reassigned.vue', 'prefer-const', 1],
  ['script-param-reassign.vue', 'no-param-reassign', 1],
  ['script-comment.vue', 'local/no-comments', 1],
  ['script-missing-return-type.vue', '@typescript-eslint/explicit-function-return-type', 1],
  ['script-mutable-private.vue', '@typescript-eslint/prefer-readonly', 1],
  ['script-floating-promise.vue', '@typescript-eslint/no-floating-promises', 1],
  ['script-compat-to-sorted.vue', COMPAT, 1],
  ['compat-to-sorted.ts', COMPAT, 1],
  ['long-file.vue', 'max-lines', 1],
  ['long-function.vue', 'max-lines-per-function', 1],
  ['long-script-block.vue', 'vue/max-lines-per-block', 1],
  ['long-template-block.vue', 'vue/max-lines-per-block', 1],
  ['options-api.vue', 'vue/component-api-style', 1],
  ['template-v-html.vue', 'vue/no-v-html', 1],
  ['template-v-html-on-component.vue', 'vue/no-v-text-v-html-on-component', 1],
  ['template-string-comparison.vue', VUE_SYNTAX, 1],
  ['template-html-comment.vue', 'local/no-html-comments', 1],
  ['template-popover-static.vue', 'vue/no-restricted-static-attribute', 1],
  ['template-popover-bind.vue', 'vue/no-restricted-v-bind', 1],
  ['template-v-for-without-key.vue', 'vue/require-v-for-key', 1],
]

describe('eslint rules on single-file components', () => {
  it.each(ruleCases)('%s reports %s %d time(s)', async (name, ruleId, count) => {
    const messages = await lintFixture(name)
    expect(forRule(messages, ruleId)).toHaveLength(count)
  }, LINT_TIMEOUT)

  it('reports nothing on a clean component', async () => {
    const messages = await lintFixture('clean.vue')
    expect(messages).toEqual([])
  }, LINT_TIMEOUT)

  it('types the script of a component: a floating promise is a typed finding', async () => {
    const messages = await lintFixture('script-floating-promise.vue')
    expect(forRule(messages, '@typescript-eslint/no-floating-promises')[0]?.line).toBe(FLOATING_LINE)
  }, LINT_TIMEOUT)

  it('keeps a component imported by a ts test typed: no unsafe rule fires', async () => {
    const messages = await lintAt('test/page/components/smoke.test.ts')
    expect(messages.filter((message) => message.ruleId?.startsWith('@typescript-eslint/no-unsafe-') === true)).toEqual([])
    const config = await configAt('test/page/components/smoke.test.ts')
    expect(severityOf(config?.rules?.['@typescript-eslint/no-unsafe-assignment'])).toBe(NUMERIC_ERROR)
    expect(severityOf(config?.rules?.['@typescript-eslint/no-unsafe-call'])).toBe(NUMERIC_ERROR)
  }, LINT_TIMEOUT)

  it('lints the repository components with the same rules', async () => {
    const messages = await lintAt('test/page/components/fixtures/smoke-fixture.vue')
    expect(messages).toEqual([])
  }, LINT_TIMEOUT)

  it('reports the template comparison on the right line', async () => {
    const messages = await lintFixture('template-string-comparison.vue')
    expect(forRule(messages, VUE_SYNTAX)[0]?.line).toBe(TEMPLATE_LINE)
  }, LINT_TIMEOUT)

  it('reports the html comment on the right line', async () => {
    const messages = await lintFixture('template-html-comment.vue')
    expect(forRule(messages, 'local/no-html-comments')[0]?.line).toBe(TEMPLATE_LINE)
  }, LINT_TIMEOUT)
})

const importCases: readonly (readonly [string, RegExp, number])[] = [
  ['components/imports-infrastructure.vue', /infrastructure/, 1],
  ['components/imports-reactive.vue', /reactive/i, NAMED_IMPORT_COUNT],
  ['components/imports-citizenfx.vue', CITIZENFX_MESSAGE, 1],
  ['components/imports-client-domain.vue', /Seul preview/, 1],
  ['application/imports-vue.vue', /pas de vue/, 1],
  ['application/imports-infrastructure.vue', /infrastructure/, 1],
  ['application/imports-components.vue', /composants/, 1],
  ['application/imports-citizenfx.vue', CITIZENFX_MESSAGE, 1],
  ['application/imports-client-domain.vue', /Seul preview/, 1],
  ['infrastructure/imports-citizenfx.vue', CITIZENFX_MESSAGE, 1],
  ['infrastructure/imports-client-domain.vue', /Seul preview/, 1],
  ['preview-pure/imports-vue.vue', /purs/, 1],
  ['preview-pure/imports-page-layers.vue', /purs/, NAMED_IMPORT_COUNT],
  ['preview-pure/imports-input.vue', /purs/, 1],
  ['preview-pure/imports-citizenfx.vue', CITIZENFX_MESSAGE, 1],
  ['preview-shell/imports-input.vue', /entrée/, 1],
  ['preview-shell/imports-citizenfx.vue', CITIZENFX_MESSAGE, 1],
]

const importFree: readonly string[] = [
  'components/imports-allowed.vue',
  'preview-pure/imports-allowed.vue',
  'preview-shell/imports-client-domain-allowed.vue',
]

describe('import restrictions on single-file components', () => {
  it.each(importCases)('%s is refused by %s', async (name, message, count) => {
    const found = forRule(await lintFixture(name), IMPORTS)
    expect(found).toHaveLength(count)
    found.forEach((entry) => expect(entry.message).toMatch(message))
  }, LINT_TIMEOUT)

  it.each(importFree)('%s imports nothing refused', async (name) => {
    expect(forRule(await lintFixture(name), IMPORTS)).toEqual([])
  }, LINT_TIMEOUT)

  it('keeps inject, computed and shallowRef importable from vue in a component', async () => {
    const messages = await lintFixture('components/imports-allowed.vue')
    expect(messages.filter((message) => message.ruleId === IMPORTS || message.ruleId?.includes('no-unsafe') === true)).toEqual([])
  }, LINT_TIMEOUT)
})

const citizenfxFolders: readonly string[] = [
  'src/page/components/a.ts',
  'src/page/components/a.vue',
  'src/page/application/a.ts',
  'src/page/application/a.vue',
  'src/page/infrastructure/a.ts',
  'src/page/i18n/a.ts',
  'preview/runtime/a.ts',
  'preview/scenarios/a.ts',
  'preview/shell/a.vue',
  'preview/a.ts',
  'src/page/domain/a.ts',
  'src/protocol/a.ts',
  'src/shared/a.ts',
]

describe('configuration of the folders that have no source yet', () => {
  it.each(citizenfxFolders)('keeps the @citizenfx group on %s', async (path) => {
    const config = await configAt(path)
    expect(JSON.stringify(config?.rules?.[IMPORTS])).toContain('@citizenfx/*')
  }, LINT_TIMEOUT)

  it.each(['src/page/components/a.vue', 'src/page/application/a.ts', 'preview/shell/a.vue', 'preview/runtime/a.ts'])('turns compat on with every ES api on %s', async (path) => {
    const config = await configAt(path)
    expect(severityOf(config?.rules?.[COMPAT])).toBe(NUMERIC_ERROR)
    expect(config?.settings?.['lintAllEsApis']).toBe(true)
  }, LINT_TIMEOUT)

  it.each(['src/page/domain/scale.ts', 'src/page/components/a.vue'])('lints %s with the page rules', async (path) => {
    const config = await configAt(path)
    expect(severityOf(config?.rules?.['local/no-comments'])).toBe(NUMERIC_ERROR)
    expect(severityOf(config?.rules?.[MAGIC])).toBe(NUMERIC_ERROR)
  }, LINT_TIMEOUT)
})
