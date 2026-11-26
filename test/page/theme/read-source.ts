import { readFileSync } from 'node:fs'

const repositoryRoot = new URL('../../../', import.meta.url)

export function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, repositoryRoot), 'utf8')
}
