import type { Reply } from '@openmemorykit/ui/contract'
import type { OwnerReplyPort } from '../../../src/client/application/ports'

export interface DeliveredReply {
  readonly owner: string
  readonly reply: Reply
}

export interface OwnerReplyFake extends OwnerReplyPort {
  readonly attempts: readonly DeliveredReply[]
  readonly delivered: readonly DeliveredReply[]
  refuseOwner(owner: string): void
}

export function createOwnerReplyFake(): OwnerReplyFake {
  const attempts: DeliveredReply[] = []
  const delivered: DeliveredReply[] = []
  const refusedOwners = new Set<string>()
  return {
    deliver(owner, reply) {
      attempts.push({ owner, reply })
      if (refusedOwners.has(owner)) return false
      delivered.push({ owner, reply })
      return true
    },
    refuseOwner(owner) {
      refusedOwners.add(owner)
    },
    attempts,
    delivered,
  }
}
