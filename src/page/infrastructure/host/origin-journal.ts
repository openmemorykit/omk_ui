import type { ValueOf } from '@openmemorykit/core/shared'
import { FromPage, type FromPageMessage } from '../../../protocol/from-page'

export const ORIGIN_JOURNAL_MAX = 8

const ORIGIN_MAX_LENGTH = 200
const UNKNOWN_ORIGIN = 'unknown'
const NO_STACK = ''
const START = 0

const MessageSource = { Self: 'self', Parent: 'parent', None: 'none', Other: 'other' } as const
type MessageSource = ValueOf<typeof MessageSource>

function originOf(event: MessageEvent<unknown>): string {
  return event.origin.length === START ? UNKNOWN_ORIGIN : event.origin.slice(START, ORIGIN_MAX_LENGTH)
}

function sourceOf(win: Window, event: MessageEvent<unknown>): MessageSource {
  if (event.source === null) return MessageSource.None
  if (event.source === win) return MessageSource.Self
  return event.source === win.parent ? MessageSource.Parent : MessageSource.Other
}

export function createOriginJournal(win: Window, report: (message: FromPageMessage) => void): (event: MessageEvent<unknown>) => void {
  const seen = new Set<string>()
  return (event) => {
    if (seen.size >= ORIGIN_JOURNAL_MAX) return
    const line = `message origin ${originOf(event)}, source ${sourceOf(win, event)}`
    if (seen.has(line)) return
    seen.add(line)
    report({ type: FromPage.PageError, message: line, stack: NO_STACK })
  }
}
