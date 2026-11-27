import type { BucketSettings } from '../rate-limit/token-bucket'

export const PLAYER_REPORT_BUCKET: BucketSettings = Object.freeze({ capacity: 40, refillPerSecond: 20 })
