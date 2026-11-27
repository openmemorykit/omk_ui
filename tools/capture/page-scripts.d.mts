import type { Survey } from './checks.mjs'

export const PROMPT_RING_FRACTION: number
export function surveyPage(radialSelector: string): Survey
export function settleAnimations(): Promise<void>
export function freezePromptRing(fraction: number, root?: Document): number
