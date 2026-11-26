import type { Panel } from '@openmemorykit/ui/contract'
import type { OwnedPanel } from '../../src/protocol/owned'
import type { StackSnapshot } from '../../src/protocol/stack'
import { deepFrozen } from './frozen'
import { FixtureOwner, OWNED_ADD_PANEL, OWNED_LIST_PANEL } from './owned'
import { ADD_PANEL, LIST_PANEL } from './panels'

export interface LocalStackPanel {
  readonly owner: string
  readonly panel: Panel
}

export const SHARED_STACK_SEQ = { Open: 1, Push: 2 } as const

export const SHARED_STACK_PANELS: readonly [LocalStackPanel, LocalStackPanel] = deepFrozen([
  { owner: FixtureOwner.Whitelist, panel: LIST_PANEL },
  { owner: FixtureOwner.Whitelist, panel: ADD_PANEL },
])

export const SHARED_STACK_OWNED: readonly [OwnedPanel, OwnedPanel] = deepFrozen([OWNED_LIST_PANEL, OWNED_ADD_PANEL])

export const SHARED_STACK_SNAPSHOT: StackSnapshot = deepFrozen({
  appliedCommandSeq: SHARED_STACK_SEQ.Push,
  entries: [
    { panelId: 'whitelist/list', owner: FixtureOwner.Whitelist },
    { panelId: 'whitelist/add', owner: FixtureOwner.Whitelist },
  ],
})
