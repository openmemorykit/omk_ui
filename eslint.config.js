import js from '@eslint/js'
import compat from 'eslint-plugin-compat'
import vue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import noHtmlComments from './tools/eslint-rules/no-html-comments.mjs'

const noComments = {
  meta: { type: 'suggestion', schema: [], messages: { comment: 'Pas de commentaire : renomme plutôt.' } },
  create(context) {
    return {
      Program() {
        context.sourceCode.getAllComments().forEach((comment) => context.report({ loc: comment.loc, messageId: 'comment' }))
      },
    }
  },
}

const stringComparison = 'BinaryExpression[operator=/^[=!]==?$/]:not([left.operator="typeof"]) > Literal[raw=/^[\'"]/]'
const stringComparisonMessage = 'Compare avec un membre de vocabulaire, pas une chaîne.'
const restrictedImports = (groups, message) => ['error', { patterns: [{ group: groups, message }] }]
const restrict = (patterns, paths = []) => ['error', { patterns: patterns.map(([group, message]) => ({ group, message })), paths }]
const citizenfx = '@citizenfx/*'
const forbidden = (...names) => names.flatMap((name) => [`**/${name}`, `**/${name}/**`])
const sides = ['page', 'client', 'server']
const sideDomain = (side) => `src/${side}/domain/**/*.ts`
const pureLayers = ['src/{protocol,shared}/**/*.ts']
const fixtures = 'test/fixtures/lint'
const sources = (real, mirror) => [`${real}/**/*.{ts,vue}`, `${fixtures}/${mirror}/**`]
const projects = ['pure', 'test', 'page', 'test.page'].map((name) => `./tsconfig.${name}.json`).concat(`./${fixtures}/tsconfig.json`)
const pageCode = ['src/{page,protocol,shared}/**/*.ts', 'src/**/*.vue', 'preview/**/*.{ts,vue}', `${fixtures}/**/*.{ts,vue}`]
const reactiveNames = ['reactive', 'ref', 'shallowReactive']
const natives = [[citizenfx], 'Les natives restent dans infrastructure, main et les côtés client et serveur.']
const clientDomainOnlyForPreview = [[...forbidden('client', 'server'), `!${citizenfx}`], 'Seul preview importe client/domain : la page n\'importe ni le client ni le serveur.']
const sdkAndCore = ['@openmemorykit/ui/sdk*', '@openmemorykit/ui/validation', '@openmemorykit/core/client', '@openmemorykit/core/server', '@openmemorykit/core/testing']

const local = { rules: { 'no-comments': noComments, 'no-html-comments': noHtmlComments } }

export default defineConfig(
  { ignores: ['**/node_modules/', '**/coverage/', '**/tools/', 'eslint.config.js', '**/vitest.config.ts', 'vite.config.ts', 'omk_ui/web/', '.public/', '.preview-dist/', 'test/captures/', 'release/', 'test/guards/fixtures/**', `${fixtures}/**`] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs['flat/base'],
  { plugins: { local } },
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        project: projects,
        extraFileExtensions: ['.vue'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'local/no-comments': 'error',
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': ['error', { ignore: [0, 1, -1], ignoreEnums: true, ignoreReadonlyClassProperties: true, ignoreTypeIndexes: true, detectObjects: false }],
      'no-restricted-syntax': ['error',
        { selector: stringComparison, message: stringComparisonMessage },
        { selector: 'SwitchCase > Literal[raw=/^[\'"]/]', message: 'Utilise un membre de vocabulaire dans les case.' },
        { selector: 'Literal[regex.flags=/v/]', message: 'Drapeau v absent de Chromium 103' },
      ],
      'id-length': ['error', { min: 3, properties: 'never', exceptions: ['x', 'y', 'z', 'id', 'ui', 'on', 'to', 'at', 'ok', 'v', '_'] }],
      'id-denylist': ['error', 'ctx', 'idx', 'msg', 'err', 'cb', 'evt', 'tmp', 'val', 'obj', 'arr', 'str', 'num', 'res', 'req', 'fn', 'm', 'e'],
      'max-lines': ['error', { max: 250, skipBlankLines: true }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true }],
      'prefer-const': 'error',
      'no-param-reassign': ['error', { props: true }],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true, allowTypedFunctionExpressions: true }],
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      'no-undef': 'off',
      'local/no-html-comments': 'error',
      'vue/no-v-html': 'error',
      'vue/no-v-text-v-html-on-component': 'error',
      'vue/no-restricted-syntax': ['error', { selector: stringComparison, message: stringComparisonMessage }],
      'vue/no-restricted-static-attribute': ['error', { key: 'popover', message: 'L\'attribut popover est absent de Chromium 103.' }],
      'vue/no-restricted-v-bind': ['error', { argument: 'popover', message: 'L\'attribut popover est absent de Chromium 103.' }],
      'vue/require-v-for-key': 'error',
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/max-lines-per-block': ['error', { script: 120, template: 120 }],
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    ignores: ['**/infrastructure/**', '**/main.ts', 'src/{client,server}/**', 'test/{client,server}/**'],
    rules: { 'no-restricted-imports': restrictedImports([citizenfx], 'Les natives restent dans infrastructure, main et les côtés client et serveur.') },
  },
  { files: pureLayers, rules: { 'no-restricted-imports': restrictedImports([citizenfx, ...forbidden('client', 'server', 'infrastructure', 'sdk'), '@openmemorykit/ui/sdk*'], 'Protocole et shared restent purs.') } },
  ...sides.map((side) => ({
    files: [sideDomain(side)],
    rules: {
      'no-restricted-imports': restrictedImports(
        [citizenfx, ...forbidden('application', 'infrastructure', 'components', ...sides.filter((other) => other !== side)), ...sdkAndCore, 'vue'],
        'Le domaine n\'importe que le domaine, shared et protocol.',
      ),
    },
  })),
  { files: ['src/*/application/**/*.ts'], rules: { 'no-restricted-imports': restrictedImports([citizenfx, ...forbidden('infrastructure', 'components')], 'L\'application n\'importe ni infrastructure ni composants.') } },
  {
    files: sources('src/page/application', 'application'),
    rules: {
      'no-restricted-imports': restrict(
        [natives, [forbidden('infrastructure', 'components'), 'L\'application n\'importe ni infrastructure ni composants.'], clientDomainOnlyForPreview],
        [{ name: 'vue', message: 'L\'application est du TypeScript pur : pas de vue.' }],
      ),
    },
  },
  {
    files: sources('src/page/components', 'components'),
    rules: {
      'no-restricted-imports': restrict(
        [natives, [forbidden('infrastructure'), 'Un composant reçoit le store : il n\'importe pas infrastructure.'], clientDomainOnlyForPreview],
        [{ name: 'vue', importNames: reactiveNames, message: 'Un composant ne crée pas d\'état : reactive, ref et shallowReactive sont absents.' }],
      ),
    },
  },
  {
    files: sources('src/page/{infrastructure,i18n}', 'infrastructure'),
    rules: { 'no-restricted-imports': restrict([natives, clientDomainOnlyForPreview]) },
  },
  {
    files: sources('preview', 'preview-shell'),
    ignores: ['preview/main.ts', 'preview/input/**'],
    rules: { 'no-restricted-imports': restrict([natives, [forbidden('input'), 'Seul preview/main.ts câble les sources d\'entrée de preview/input.']]) },
  },
  ...[
    ['preview/scenarios', 'preview-pure', []],
    ['preview/runtime', 'preview-runtime', true],
  ].map(([real, mirror, portsOpen]) => ({
    files: sources(real, mirror),
    rules: {
      'no-restricted-imports': restrict(
        [
          natives,
          [
            [...forbidden('server', 'infrastructure', 'components', 'input', 'shell', 'i18n', 'theme'), ...(portsOpen ? ['**/application/*', '**/application/*/**', '!**/application/ports'] : forbidden('application')), ...sdkAndCore.filter((name) => !name.endsWith('/validation')), `!${citizenfx}`],
            'Scénarios et runtime de l\'aperçu sont purs : contrat, validation, protocole, client/domain et page/domain seulement.',
          ],
        ],
        [{ name: 'vue', message: 'Scénarios et runtime de l\'aperçu sont purs : contrat, validation, protocole, client/domain et page/domain seulement.' }],
      ),
    },
  })),
  { ...compat.configs['flat/recommended'], files: pageCode, settings: { lintAllEsApis: true } },
  { files: ['test/**/*.ts'], rules: { 'max-lines-per-function': 'off' } },
)
