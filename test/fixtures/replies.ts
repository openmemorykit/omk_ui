import { CloseReason, ReplyKind } from '@openmemorykit/ui/contract'
import type { Reply } from '@openmemorykit/ui/contract'
import type { OwnedReply } from '../../src/protocol/stack'
import { deepFrozen } from './frozen'
import { FixtureOwner } from './owned'

export type ReplyOf<Kind extends ReplyKind> = Extract<Reply, { readonly kind: Kind }>

export const FIRST_SUBMISSION_ID = 1

type RepliesByKind = Readonly<{ [Kind in ReplyKind]: ReplyOf<Kind> }>

export const LOCAL_REPLIES: RepliesByKind = deepFrozen({
  [ReplyKind.ItemSelected]: { kind: ReplyKind.ItemSelected, panelId: 'list', itemId: 'player-1' },
  [ReplyKind.ValueChanged]: { kind: ReplyKind.ValueChanged, panelId: 'list', itemId: 'enabled', value: false },
  [ReplyKind.FormSubmitted]: {
    kind: ReplyKind.FormSubmitted,
    panelId: 'add',
    submissionId: FIRST_SUBMISSION_ID,
    values: { identifier: 'license:0123abcd', role: 'member', notify: true },
  },
  [ReplyKind.ConfirmAnswered]: { kind: ReplyKind.ConfirmAnswered, confirmId: 'remove-player-1', confirmed: true },
  [ReplyKind.PanelClosed]: { kind: ReplyKind.PanelClosed, panelId: 'list', reason: CloseReason.Back },
  [ReplyKind.RadialSelected]: { kind: ReplyKind.RadialSelected, entryId: 'main', childId: 'add' },
  [ReplyKind.PromptCompleted]: { kind: ReplyKind.PromptCompleted, promptId: 'open-door' },
})

export const PAGE_REPLIES: RepliesByKind = deepFrozen({
  [ReplyKind.ItemSelected]: { ...LOCAL_REPLIES[ReplyKind.ItemSelected], panelId: 'whitelist/list' },
  [ReplyKind.ValueChanged]: { ...LOCAL_REPLIES[ReplyKind.ValueChanged], panelId: 'whitelist/list' },
  [ReplyKind.FormSubmitted]: { ...LOCAL_REPLIES[ReplyKind.FormSubmitted], panelId: 'whitelist/add' },
  [ReplyKind.ConfirmAnswered]: { ...LOCAL_REPLIES[ReplyKind.ConfirmAnswered], confirmId: 'whitelist/remove-player-1' },
  [ReplyKind.PanelClosed]: { ...LOCAL_REPLIES[ReplyKind.PanelClosed], panelId: 'whitelist/list' },
  [ReplyKind.RadialSelected]: { ...LOCAL_REPLIES[ReplyKind.RadialSelected], entryId: 'whitelist/main' },
  [ReplyKind.PromptCompleted]: { ...LOCAL_REPLIES[ReplyKind.PromptCompleted], promptId: 'garage/open-door' },
})

export const REPLY_OWNER: Readonly<Record<ReplyKind, string>> = deepFrozen({
  [ReplyKind.ItemSelected]: FixtureOwner.Whitelist,
  [ReplyKind.ValueChanged]: FixtureOwner.Whitelist,
  [ReplyKind.FormSubmitted]: FixtureOwner.Whitelist,
  [ReplyKind.ConfirmAnswered]: FixtureOwner.Whitelist,
  [ReplyKind.PanelClosed]: FixtureOwner.Whitelist,
  [ReplyKind.RadialSelected]: FixtureOwner.Whitelist,
  [ReplyKind.PromptCompleted]: FixtureOwner.Garage,
})

export const OWNED_REPLIES: readonly OwnedReply[] = deepFrozen([
  { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.ItemSelected] },
  { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.ValueChanged] },
  { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.FormSubmitted] },
  { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.ConfirmAnswered] },
  { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.PanelClosed] },
  { owner: FixtureOwner.Whitelist, reply: PAGE_REPLIES[ReplyKind.RadialSelected] },
  { owner: FixtureOwner.Garage, reply: PAGE_REPLIES[ReplyKind.PromptCompleted] },
])
