import type { Reply } from '@openmemorykit/ui/contract'
import type { OwnerReplyPort } from '../application/ports'
import { guardedNativeCall, type NativeFailureHandler } from './guarded-native-call'

const REPLY_EXPORT = 'omk_ui_reply'

type ReplyExport = (reply: Reply) => unknown

function replyExportOf(owner: string): ReplyExport {
  const replyExport = globalThis.exports[owner]?.[REPLY_EXPORT] as ReplyExport | undefined
  if (replyExport === undefined) throw new Error(`${owner} has no ${REPLY_EXPORT} export`)
  return replyExport
}

export function createOwnerReplyPort(onFailure: NativeFailureHandler): OwnerReplyPort {
  return {
    deliver: (owner, reply) =>
      guardedNativeCall(onFailure, `${REPLY_EXPORT} of ${owner}`, () => {
        replyExportOf(owner)(reply)
        return true
      }, false),
  }
}
