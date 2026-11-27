import { isPlainObject as coreIsPlainObject } from '@openmemorykit/core/shared'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPlainObject } from '../../../src/shared/report/own-strict-object'

const FOLDERS = ['src/server', 'src/shared/report']
const DUPLICATED_GUARD = /function (isPlainObject|isRecord|hasOwnKey)\b|hasOwnProperty/

function sourcesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? sourcesUnder(path) : [path]
  })
}

describe('guards shared with @openmemorykit/core', () => {
  it('re-exports the plain object guard of core instead of a copy', () => {
    expect(isPlainObject).toBe(coreIsPlainObject)
  })

  it.each(FOLDERS.flatMap(sourcesUnder))('%s defines no copy of a core guard', (path) => {
    expect(readFileSync(path, 'utf8')).not.toMatch(DUPLICATED_GUARD)
  })
})
