import { mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createZip } from '../../tools/zip.mjs'

function unzip(args: string[], bytes: Buffer): { status: number | null; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'omk-zip-'))
  const path = join(dir, 'a.zip')
  writeFileSync(path, bytes)
  const run = spawnSync('unzip', [...args, path], { encoding: 'utf8' })
  return { status: run.status, stdout: run.stdout }
}

describe('tools/zip', () => {
  const entries = [
    { name: 'dir/hello.txt', data: Buffer.from('hello hello hello hello') },
    { name: 'empty.txt', data: Buffer.alloc(0) },
    { name: 'é/accent.bin', data: Buffer.from([0, 1, 2, 255]) },
  ]

  it('produces an archive that unzip lists with every name', () => {
    const listing = unzip(['-l'], createZip(entries)).stdout
    expect(listing).toContain('dir/hello.txt')
    expect(listing).toContain('empty.txt')
    expect(listing).toContain('3 files')
  })

  it('produces an archive that passes the integrity test', () => {
    const result = unzip(['-t'], createZip(entries))
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No errors detected')
  })

  it('restores the exact bytes', () => {
    const result = unzip(['-p'], createZip([entries[0] as (typeof entries)[0]]))
    expect(result.stdout).toBe('hello hello hello hello')
  })

  it('is deterministic', () => {
    expect(createZip(entries).equals(createZip(entries))).toBe(true)
  })

  it('compresses repetitive data', () => {
    const big = Buffer.alloc(100_000, 'a')
    expect(createZip([{ name: 'big.txt', data: big }]).length).toBeLessThan(big.length / 10)
  })

  it('refuses duplicate names', () => {
    expect(() => createZip([entries[0] as (typeof entries)[0], entries[0] as (typeof entries)[0]])).toThrow(/duplicate/i)
  })

  it('refuses unsafe names', () => {
    expect(() => createZip([{ name: '../x', data: Buffer.alloc(0) }])).toThrow(/name/i)
    expect(() => createZip([{ name: '/x', data: Buffer.alloc(0) }])).toThrow(/name/i)
  })
})
