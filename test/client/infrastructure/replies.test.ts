import { createExportsFake, createSerializationFake, EmptyTableShape } from '@openmemorykit/core/testing'
import { ReplyKind, type Reply } from '@openmemorykit/ui/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOwnerReplyPort } from '../../../src/client/infrastructure/replies'

const REPLY: Reply = { kind: ReplyKind.PanelClosed, panelId: 'whitelist/list', reason: 'back' } as unknown as Reply
const failures: unknown[][] = []

afterEach(() => {
  vi.unstubAllGlobals()
  failures.length = 0
})

function setUp(): ReturnType<typeof createExportsFake> {
  const fake = createExportsFake(createSerializationFake(EmptyTableShape.Object), 'omk_ui')
  vi.stubGlobal('exports', fake.exports)
  return fake
}

const port = (): ReturnType<typeof createOwnerReplyPort> => createOwnerReplyPort((operation, cause) => { failures.push([operation, cause]) })

describe('createOwnerReplyPort', () => {
  it('delivers a reply through the omk_ui_reply export of its owner', () => {
    const fake = setUp()
    const received: unknown[] = []
    fake.register('garage', 'omk_ui_reply', (reply: unknown) => { received.push(reply) })
    expect(port().deliver('garage', REPLY)).toBe(true)
    expect(received).toEqual([REPLY])
  })

  it('delivers to no other resource than the owner', () => {
    const fake = setUp()
    const others: unknown[] = []
    fake.register('garage', 'omk_ui_reply', () => undefined)
    fake.register('whitelist', 'omk_ui_reply', (reply: unknown) => { others.push(reply) })
    port().deliver('garage', REPLY)
    expect(others).toEqual([])
  })

  it('returns false and reports when the owner has no omk_ui_reply export', () => {
    setUp()
    expect(port().deliver('gone', REPLY)).toBe(false)
    expect(failures.map(([operation]) => operation)).toEqual(['omk_ui_reply of gone'])
  })

  it('returns false and reports when the export of the owner throws', () => {
    const fake = setUp()
    const boom = new Error('boom')
    fake.register('garage', 'omk_ui_reply', () => { throw boom })
    expect(port().deliver('garage', REPLY)).toBe(false)
    expect(failures[0]?.[1]).toBeInstanceOf(Error)
  })
})
