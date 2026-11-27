export const ClientSnapshotField = {
  Locale: 'locale',
  Resolution: 'resolution',
  Scale: 'scale',
  Mode: 'mode',
  Paused: 'paused',
  Modality: 'modality',
  Focus: 'focus',
  Cursor: 'cursor',
  KeepInput: 'keepInput',
  RadialEntries: 'radialEntries',
  RadialPosition: 'radialPosition',
  Prompt: 'prompt',
  NotificationsVisible: 'notificationsVisible',
  NotificationsQueued: 'notificationsQueued',
  RadialKey: 'radialKey',
  InteractKey: 'interactKey',
  GlyphSet: 'glyphSet',
  HeldIntents: 'heldIntents',
  LastIntent: 'lastIntent',
  AckSeq: 'ackSeq',
} as const

export const ResolutionField = { Width: 'width', Height: 'height' } as const
export const LastIntentField = { Intent: 'intent', Source: 'source', Seq: 'seq', AgoMs: 'agoMs' } as const

export const PageSnapshotField = { AppliedCommandSeq: 'appliedCommandSeq', Panels: 'panels', Keyboard: 'keyboard', Form: 'form' } as const
export const SnapshotPanelField = { Id: 'id', Focus: 'focus' } as const
export const KeyboardField = { Name: 'name', Layer: 'layer', Length: 'length', Max: 'max' } as const
export const FormField = { Panel: 'panel', State: 'state', Submission: 'submission', Errors: 'errors' } as const
