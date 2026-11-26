import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const LOOPBACK = '127.0.0.1'
const INDEX = 'index.html'
const NOT_FOUND = 404
const BAD_REQUEST = 400
const METHOD_NOT_ALLOWED = 405
const OK = 200
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
])
const DEFAULT_TYPE = 'application/octet-stream'

function resolveFile(root, rawUrl) {
  const pathname = new URL(rawUrl, 'http://localhost').pathname
  const decoded = decodeURIComponent(pathname)
  const relative = normalize(decoded === '/' ? INDEX : decoded.slice(1))
  const target = join(root, relative)
  const inside = !decoded.includes('\0') && target.startsWith(root + sep)
  const stat = inside ? statSync(target, { throwIfNoEntry: false }) : undefined
  return stat?.isFile() === true ? target : null
}

function answer(root, request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(METHOD_NOT_ALLOWED).end()
    return
  }
  let file
  try {
    file = resolveFile(root, request.url ?? '/')
  } catch {
    response.writeHead(BAD_REQUEST).end()
    return
  }
  if (file === null) {
    response.writeHead(NOT_FOUND).end()
    return
  }
  response.writeHead(OK, { 'content-type': CONTENT_TYPES.get(extname(file)) ?? DEFAULT_TYPE })
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).on('error', () => response.destroy()).pipe(response)
}

export function serveStatic(root, port) {
  const absolute = resolve(root)
  const server = createServer((request, response) => answer(absolute, request, response))
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, LOOPBACK, () => {
      const address = server.address()
      resolve({
        server,
        port: typeof address === 'object' && address !== null ? address.port : port,
        close: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections() }),
      })
    })
  })
}
