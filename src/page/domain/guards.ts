import type { OwnedReply } from '../../protocol/stack'

export const NO_REPLIES: readonly OwnedReply[] = Object.freeze([])

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null

export const isList = <Element>(value: readonly Element[] | undefined): value is readonly Element[] => Array.isArray(value)

export function isNewerCommand(appliedCommandSeq: number, commandSeq: number): boolean {
  return Number.isSafeInteger(commandSeq) && commandSeq > appliedCommandSeq
}
