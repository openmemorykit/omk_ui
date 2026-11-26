import { BYTES_PER_SECOND, CALL_BURST, CALLS_PER_SECOND, ContractErrorCode, NOTIFICATIONS_PER_SECOND, type ContractError } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'
import { fullBucket, takeTokens, type BucketSettings, type TokenBucket } from '../../shared/rate-limit/token-bucket'

export const CallFamily = { Notify: 'notify', Other: 'other' } as const
export type CallFamily = ValueOf<typeof CallFamily>

export const LimitedBucket = { Calls: 'calls', Notifications: 'notifications', Bytes: 'bytes' } as const
export type LimitedBucket = ValueOf<typeof LimitedBucket>

export const CALLS_BUCKET: BucketSettings = Object.freeze({ capacity: CALL_BURST, refillPerSecond: CALLS_PER_SECOND })
export const NOTIFICATIONS_BUCKET: BucketSettings = Object.freeze({ capacity: NOTIFICATIONS_PER_SECOND, refillPerSecond: NOTIFICATIONS_PER_SECOND })
export const BYTES_BUCKET: BucketSettings = Object.freeze({ capacity: BYTES_PER_SECOND, refillPerSecond: BYTES_PER_SECOND })

const CALL_COST = 1
const REFUSAL_PATH = ''

export interface OwnerBuckets {
  readonly calls: TokenBucket
  readonly notifications: TokenBucket
  readonly bytes: TokenBucket
}

export interface CallLimitsState {
  readonly owners: ReadonlyMap<string, OwnerBuckets>
}

export interface CallAdmission {
  readonly state: CallLimitsState
  readonly refusal: ContractError | null
}

export const EMPTY_CALL_LIMITS: CallLimitsState = Object.freeze({ owners: new Map<string, OwnerBuckets>() })

function freshBuckets(now: number): OwnerBuckets {
  return { calls: fullBucket(CALLS_BUCKET, now), notifications: fullBucket(NOTIFICATIONS_BUCKET, now), bytes: fullBucket(BYTES_BUCKET, now) }
}

function refusalFor(limited: LimitedBucket): ContractError {
  return { path: REFUSAL_PATH, code: ContractErrorCode.RateLimited, detail: limited }
}

function admission(state: CallLimitsState, limited: LimitedBucket): CallAdmission {
  return { state, refusal: refusalFor(limited) }
}

export function admitCall(state: CallLimitsState, owner: string, family: CallFamily, bytes: number, now: number): CallAdmission {
  if (!Number.isFinite(now)) return admission(state, LimitedBucket.Calls)
  const current = state.owners.get(owner) ?? freshBuckets(now)
  const calls = takeTokens(current.calls, CALLS_BUCKET, CALL_COST, now)
  if (!calls.allowed) return admission(state, LimitedBucket.Calls)
  const notifying = family === CallFamily.Notify
  const notifications = notifying ? takeTokens(current.notifications, NOTIFICATIONS_BUCKET, CALL_COST, now) : { allowed: true, bucket: current.notifications }
  if (!notifications.allowed) return admission(state, LimitedBucket.Notifications)
  const taken = takeTokens(current.bytes, BYTES_BUCKET, bytes, now)
  if (!taken.allowed) return admission(state, LimitedBucket.Bytes)
  const owners = state === EMPTY_CALL_LIMITS ? new Map<string, OwnerBuckets>() : (state.owners as Map<string, OwnerBuckets>)
  owners.set(owner, { calls: calls.bucket, notifications: notifications.bucket, bytes: taken.bucket })
  return { state: { owners }, refusal: null }
}
