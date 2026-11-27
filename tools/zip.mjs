import { crc32, deflateRawSync } from 'node:zlib'

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const VERSION_NEEDED = 20
const UNIX_MADE_BY = (3 << 8) | VERSION_NEEDED
const UTF8_FLAG = 0x0800
const METHOD_STORED = 0
const METHOD_DEFLATED = 8
const DOS_DATE = (1 << 5) | 1
const DOS_TIME = 0
const FILE_MODE = (0o100644 << 16) >>> 0
const MAX_ENTRIES = 0xffff
const MAX_BYTES = 0xffffffff
const LOCAL_HEADER_SIZE = 30
const CENTRAL_HEADER_SIZE = 46
const END_RECORD_SIZE = 22

function checkName(name, seen) {
  if (name === '' || name.startsWith('/') || name.split('/').includes('..') || name.includes('\\')) throw new Error(`Invalid entry name: ${name}`)
  if (seen.has(name)) throw new Error(`Duplicate entry name: ${name}`)
  seen.add(name)
}

function compress(data) {
  const deflated = deflateRawSync(data, { level: 9 })
  return deflated.length < data.length ? { method: METHOD_DEFLATED, body: deflated } : { method: METHOD_STORED, body: data }
}

function localHeader(entry, packed, name) {
  const header = Buffer.alloc(LOCAL_HEADER_SIZE)
  header.writeUInt32LE(LOCAL_SIGNATURE, 0)
  header.writeUInt16LE(VERSION_NEEDED, 4)
  header.writeUInt16LE(UTF8_FLAG, 6)
  header.writeUInt16LE(packed.method, 8)
  header.writeUInt16LE(DOS_TIME, 10)
  header.writeUInt16LE(DOS_DATE, 12)
  header.writeUInt32LE(crc32(entry.data), 14)
  header.writeUInt32LE(packed.body.length, 18)
  header.writeUInt32LE(entry.data.length, 22)
  header.writeUInt16LE(name.length, 26)
  return Buffer.concat([header, name])
}

function centralHeader(local, offset, name) {
  const header = Buffer.alloc(CENTRAL_HEADER_SIZE)
  header.writeUInt32LE(CENTRAL_SIGNATURE, 0)
  header.writeUInt16LE(UNIX_MADE_BY, 4)
  local.copy(header, 6, 4, 4 + 26)
  header.writeUInt32LE(FILE_MODE, 38)
  header.writeUInt32LE(offset, 42)
  return Buffer.concat([header, name])
}

export function createZip(entries) {
  if (entries.length > MAX_ENTRIES) throw new Error('Too many entries')
  const seen = new Set()
  const parts = []
  const central = []
  let offset = 0
  for (const entry of entries) {
    checkName(entry.name, seen)
    const name = Buffer.from(entry.name, 'utf8')
    const packed = compress(entry.data)
    const local = localHeader(entry, packed, name)
    central.push(centralHeader(local, offset, name))
    parts.push(local, packed.body)
    offset += local.length + packed.body.length
  }
  const directory = Buffer.concat(central)
  if (offset + directory.length > MAX_BYTES) throw new Error('Archive too large')
  const end = Buffer.alloc(END_RECORD_SIZE)
  end.writeUInt32LE(END_SIGNATURE, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, directory, end])
}
