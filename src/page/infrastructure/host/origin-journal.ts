import type { ValueOf } from '@openmemorykit/core/shared'
import { pageErrorMessage } from '../../application/page-errors'
import type { FromPageMessage } from '../../../protocol/from-page'

export const ORIGIN_JOURNAL_MAX = 8
export const ORIGIN_PENDING_MAX = 4
export const ORIGIN_LINE_PREFIX = 'message origin:'
export const UNREADABLE_ORIGIN = 'unreadable'

const ORIGIN_MAX_LENGTH = 200
const UNKNOWN_ORIGIN = 'unknown'
const NO_STACK = ''
const START = 0
const NONE = 0

const MessageSource = { Self: 'self', Parent: 'parent', None: 'none', Other: 'other' } as const
type MessageSource = ValueOf<typeof MessageSource>

export type OriginReport = (message: FromPageMessage) => boolean

function originOf(event: MessageEvent<unknown>): string {
  try {
    return event.origin.length === START ? UNKNOWN_ORIGIN : event.origin.slice(START, ORIGIN_MAX_LENGTH)
  } catch {
    return UNREADABLE_ORIGIN
  }
}

function sourceOf(win: Window, event: MessageEvent<unknown>): MessageSource {
  if (event.source === null) return MessageSource.None
  if (event.source === win) return MessageSource.Self
  return event.source === win.parent ? MessageSource.Parent : MessageSource.Other
}

function lostSuffix(lost: number): string {
  return lost > NONE ? `, ${String(lost)} lines lost` : ''
}

export function createOriginJournal(win: Window, report: OriginReport): (event: MessageEvent<unknown>) => void {
  const seen = new Set<string>()
  let lost = NONE
  return (event) => {
    if (seen.size >= ORIGIN_JOURNAL_MAX) return
    const line = `${ORIGIN_LINE_PREFIX} ${originOf(event)}, source ${sourceOf(win, event)}`
    if (seen.has(line)) return
    if (report(pageErrorMessage(`${line}${lostSuffix(lost)}`, NO_STACK))) {
      seen.add(line)
      lost = NONE
      return
    }
    lost += 1
  }
}
