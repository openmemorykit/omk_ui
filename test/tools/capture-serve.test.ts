import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { serveStatic } from '../../tools/capture/serve.mjs'

interface Reply { readonly status: number; readonly type: string; readonly body: string }

let root = ''
let closers: Array<() => Promise<void>> = []

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'omk-serve-'))
  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>x</title>')
  writeFileSync(join(root, 'assets', 'app.js'), 'export {}')
  writeFileSync(join(root, 'assets', 'app.css'), 'a{}')
  writeFileSync(join(root, 'assets', 'font.woff2'), 'w')
  writeFileSync(join(root, 'assets', 'data.bin'), 'b')
})
afterEach(async () => {
  await Promise.all(closers.map((close) => close()))
  closers = []
})

async function start(): Promise<number> {
  const handle = await serveStatic(root, 0)
  closers.push(handle.close)
  return handle.port
}

function get(port: number, path: string, method = 'GET'): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('capture static server', () => {
  it('serves index.html at the root, ignoring the query string', async () => {
    const port = await start()
    const reply = await get(port, '/?scenario=radial&capture=1')
    expect(reply.status).toBe(200)
    expect(reply.type).toContain('text/html')
    expect(reply.body).toContain('<title>x</title>')
  })

  it('gives each asset its content type', async () => {
    const port = await start()
    expect((await get(port, '/assets/app.js')).type).toContain('text/javascript')
    expect((await get(port, '/assets/app.css')).type).toContain('text/css')
    expect((await get(port, '/assets/font.woff2')).type).toBe('font/woff2')
    expect((await get(port, '/assets/data.bin')).type).toBe('application/octet-stream')
  })

  it('answers 404 for a missing file and for a directory', async () => {
    const port = await start()
    expect((await get(port, '/nope.js')).status).toBe(404)
    expect((await get(port, '/assets')).status).toBe(404)
  })

  it('refuses paths that leave the root', async () => {
    const port = await start()
    expect((await get(port, '/../package.json')).status).toBe(404)
    expect((await get(port, '/%2e%2e/package.json')).status).toBe(404)
    expect((await get(port, '/assets/%2e%2e/%2e%2e/package.json')).status).toBe(404)
    expect((await get(port, '/%00')).status).toBe(404)
    expect((await get(port, '/%E0%A4%A')).status).toBe(400)
  })

  it('answers HEAD without a body and refuses other methods', async () => {
    const port = await start()
    const head = await get(port, '/assets/app.js', 'HEAD')
    expect(head.status).toBe(200)
    expect(head.body).toBe('')
    expect((await get(port, '/', 'POST')).status).toBe(405)
  })

  it('binds to loopback on the requested port and stops on close', async () => {
    const handle = await serveStatic(root, 0)
    expect(handle.port).toBeGreaterThan(0)
    expect((handle.server.address() as AddressInfo).address).toBe('127.0.0.1')
    await handle.close()
    await expect(get(handle.port, '/')).rejects.toThrow()
  })
})
