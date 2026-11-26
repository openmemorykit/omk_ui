import { spawnSync } from 'node:child_process'

const configs = ['pure', 'test'].map((name) => `tsconfig.${name}.json`)

for (const config of configs) {
  const { status } = spawnSync('npx', ['tsc', '-p', config], { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}
