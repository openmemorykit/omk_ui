import type { Reply } from '@openmemorykit/ui/contract'
import type { OwnerReplyPort } from '../application/ports'
import { guardedCall, type FailureHandler } from '../../shared/guarded-call'

const REPLY_EXPORT = 'omk_ui_reply'

interface OwnerExports {
  readonly [REPLY_EXPORT]: (reply: Reply) => unknown
}

export function createOwnerReplyPort(onFailure: FailureHandler): OwnerReplyPort {
  return {
    deliver: (owner, reply) =>
      guardedCall(onFailure, `${REPLY_EXPORT} of ${owner}`, () => {
        const ownerExports = globalThis.exports[owner] as unknown as OwnerExports
        ownerExports[REPLY_EXPORT](reply)
        return true
      }, false),
  }
}
