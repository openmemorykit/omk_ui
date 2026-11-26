import { BYTES_PER_SECOND, CALL_BURST, CALLS_PER_SECOND, ContractErrorCode, NOTIFICATIONS_PER_SECOND, type ContractError } from '@openmemorykit/ui/contract'
import type { ValueOf } from '@openmemorykit/core/shared'
import { fullBucket, takeTokens, type BucketSettings, type TokenBucket } from '../../shared/rate-limit/token-bucket'

export const CallFamily = { Notify: 'notify', Other: 'other' } as const
export type CallFamily = ValueOf<typeof CallFamily>

export const LimitedBucket = { Calls: 'calls', Notifications: 'notifications', Bytes: 'bytes', Owners: 'owners' } as const
export type LimitedBucket = ValueOf<typeof LimitedBucket>

export const CALLS_BUCKET: BucketSettings = Object.freeze({ capacity: CALL_BURST, refillPerSecond: CALLS_PER_SECOND })
export const NOTIFICATIONS_BUCKET: BucketSettings = Object.freeze({ capacity: NOTIFICATIONS_PER_SECOND, refillPerSecond: NOTIFICATIONS_PER_SECOND })
export const BYTES_BUCKET: BucketSettings = Object.freeze({ capacity: BYTES_PER_SECOND, refillPerSecond: BYTES_PER_SECOND })

export const MAX_TRACKED_OWNERS = 1024
const CALL_COST = 1
const REFUSAL_PATH = ''

export interface OwnerBuckets {
  readonly calls: TokenBucket
  readonly notifications: TokenBucket
  readonly bytes: TokenBucket
}

export interface OwnerAdmission {
  readonly buckets: OwnerBuckets | undefined
  readonly refusal: ContractError | null
}

function freshBuckets(now: number): OwnerBuckets {
  return { calls: fullBucket(CALLS_BUCKET, now), notifications: fullBucket(NOTIFICATIONS_BUCKET, now), bytes: fullBucket(BYTES_BUCKET, now) }
}

function refusalFor(limited: LimitedBucket): ContractError {
  return { path: REFUSAL_PATH, code: ContractErrorCode.RateLimited, detail: limited }
}

function refused(buckets: OwnerBuckets | undefined, limited: LimitedBucket): OwnerAdmission {
  return { buckets, refusal: refusalFor(limited) }
}

function takeFamily(current: OwnerBuckets, family: CallFamily, now: number): { readonly allowed: boolean; readonly limited: LimitedBucket; readonly calls: TokenBucket; readonly notifications: TokenBucket } {
  if (family === CallFamily.Notify) {
    const taken = takeTokens(current.notifications, NOTIFICATIONS_BUCKET, CALL_COST, now)
    return { allowed: taken.allowed, limited: LimitedBucket.Notifications, calls: current.calls, notifications: taken.bucket }
  }
  const taken = takeTokens(current.calls, CALLS_BUCKET, CALL_COST, now)
  return { allowed: taken.allowed, limited: LimitedBucket.Calls, calls: taken.bucket, notifications: current.notifications }
}

export function admitOwnerCall(buckets: OwnerBuckets | undefined, family: CallFamily, bytes: number, now: number): OwnerAdmission {
  if (!Number.isFinite(now)) return refused(buckets, LimitedBucket.Calls)
  const current = buckets ?? freshBuckets(now)
  const familyTaken = takeFamily(current, family, now)
  if (!familyTaken.allowed) return refused(buckets, familyTaken.limited)
  const taken = takeTokens(current.bytes, BYTES_BUCKET, bytes, now)
  if (!taken.allowed) return refused(buckets, LimitedBucket.Bytes)
  return { buckets: { calls: familyTaken.calls, notifications: familyTaken.notifications, bytes: taken.bucket }, refusal: null }
}

export class CallLimiter {
  private readonly owners = new Map<string, OwnerBuckets>()

  admit(owner: string, family: CallFamily, bytes: number, now: number): ContractError | null {
    const known = this.owners.get(owner)
    if (known === undefined && this.owners.size >= MAX_TRACKED_OWNERS) return refusalFor(LimitedBucket.Owners)
    const admission = admitOwnerCall(known, family, bytes, now)
    if (admission.refusal === null && admission.buckets !== undefined) this.owners.set(owner, admission.buckets)
    return admission.refusal
  }

  forget(owner: string): void {
    this.owners.delete(owner)
  }

  get trackedOwners(): number {
    return this.owners.size
  }
}
