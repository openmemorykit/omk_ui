import type { ValueOf } from '@openmemorykit/core/shared'

export const OmkSubcommand = {
  Version: 'version',
  Config: 'config',
  Trace: 'trace',
  Debug: 'debug',
  Owners: 'owners',
  Demo: 'demo',
  Intent: 'intent',
  Notify: 'notify',
  Close: 'close',
  Ask: 'ask',
} as const
export type OmkSubcommand = ValueOf<typeof OmkSubcommand>
