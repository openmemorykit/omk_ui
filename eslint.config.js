import js from '@eslint/js'
import compat from 'eslint-plugin-compat'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

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
const restrictedImports = (groups, message) => ['error', { patterns: [{ group: groups, message }] }]
const citizenfx = '@citizenfx/*'
const forbidden = (...names) => names.flatMap((name) => [`**/${name}`, `**/${name}/**`])
const sides = ['page', 'client', 'server']
const sideDomain = (side) => `src/${side}/domain/**/*.ts`
const pureLayers = ['src/{protocol,shared}/**/*.ts']
const pageCode = ['src/{page,protocol,shared}/**/*.ts']
const projects = ['pure', 'test', 'page', 'test.page'].map((name) => `./tsconfig.${name}.json`)

export default defineConfig(
  { ignores: ['**/node_modules/', '**/coverage/', '**/tools/', 'eslint.config.js', '**/vitest.config.ts', 'vite.config.ts', '**/*.vue', 'omk_ui/web/', '.public/', '.preview-dist/', 'test/captures/', 'release/', 'test/guards/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: projects,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { local: { rules: { 'no-comments': noComments } } },
    rules: {
      'local/no-comments': 'error',
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': ['error', { ignore: [0, 1, -1], ignoreEnums: true, ignoreReadonlyClassProperties: true, ignoreTypeIndexes: true, detectObjects: false }],
      'no-restricted-syntax': ['error',
        { selector: stringComparison, message: 'Compare avec un membre de vocabulaire, pas une chaîne.' },
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
    files: ['**/*.ts'],
    ignores: ['**/infrastructure/**', '**/main.ts', 'src/{client,server}/**', 'test/{client,server}/**'],
    rules: { 'no-restricted-imports': restrictedImports([citizenfx], 'Les natives restent dans infrastructure, main et les côtés client et serveur.') },
  },
  { files: pureLayers, rules: { 'no-restricted-imports': restrictedImports([citizenfx, ...forbidden('client', 'server', 'infrastructure', 'sdk'), '@openmemorykit/ui/sdk*'], 'Protocole et shared restent purs.') } },
  ...sides.map((side) => ({
    files: [sideDomain(side)],
    rules: {
      'no-restricted-imports': restrictedImports(
        [citizenfx, ...forbidden('application', 'infrastructure', 'components', ...sides.filter((other) => other !== side)), '@openmemorykit/ui/sdk*', '@openmemorykit/ui/validation', '@openmemorykit/core/client', '@openmemorykit/core/server', '@openmemorykit/core/testing', 'vue'],
        'Le domaine n\'importe que le domaine, shared et protocol.',
      ),
    },
  })),
  { files: ['src/*/application/**/*.ts'], rules: { 'no-restricted-imports': restrictedImports([citizenfx, ...forbidden('infrastructure', 'components')], 'L\'application n\'importe ni infrastructure ni composants.') } },
  { ...compat.configs['flat/recommended'], files: pageCode, settings: { lintAllEsApis: true } },
  { files: ['test/**/*.ts'], rules: { 'max-lines-per-function': 'off' } },
)
