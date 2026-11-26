import type { ValueOf } from '@openmemorykit/core/shared'

export const UiMode = { Idle: 'idle', Radial: 'radial', Waiting: 'waiting', Panels: 'panels' } as const
export type UiMode = ValueOf<typeof UiMode>

export const GlyphSet = { Xbox: 'xbox', PlayStation: 'playStation' } as const
export type GlyphSet = ValueOf<typeof GlyphSet>

export const PromptState = { Holding: 'holding', Cancelled: 'cancelled', Completed: 'completed' } as const
export type PromptState = ValueOf<typeof PromptState>
