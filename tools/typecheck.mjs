import { spawnSync } from 'node:child_process'

const programs = [
  ['tsc', 'pure'],
  ['tsc', 'test'],
  ['tsc', 'client'],
  ['tsc', 'server'],
  ['tsc', 'test.client'],
  ['tsc', 'test.server'],
  ['vue-tsc', 'page'],
  ['vue-tsc', 'test.page'],
]

for (const [compiler, name] of programs) {
  const { status } = spawnSync('npx', [compiler, '--noEmit', '-p', `tsconfig.${name}.json`], { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}
